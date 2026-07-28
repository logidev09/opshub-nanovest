"use server";

import { FeedbackCategory, FeedbackModule, FeedbackStatus } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/features/shared/lib/db";
import { AuditService } from "@/features/audit/services/audit.service";

type SessionUser = {
  id: string;
  role?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function submitSystemFeedbackAction(input: {
  module: FeedbackModule;
  category: FeedbackCategory;
  message: string;
  attachmentName?: string;
  attachmentData?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  const message = input.message.trim();

  if (!message) {
    return { success: false, error: "Pesan feedback wajib diisi." };
  }

  try {
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });

    const finalMessage =
      input.attachmentName && input.attachmentData
        ? `${message}\n\n---ATTACHMENT_START---\nNAME: ${input.attachmentName}\nDATA: ${input.attachmentData}\n---ATTACHMENT_END---`
        : message;

    const feedback = await prisma.systemFeedback.create({
      data: {
        module: input.module,
        category: input.category,
        message: finalMessage,
        submittedById: sessionUser.id,
        assignedToId: admin?.id,
      },
    });

    await AuditService.log({
      userId: sessionUser.id,
      action: "CREATE_SYSTEM_FEEDBACK",
      entity: "SystemFeedback",
      entityId: feedback.id,
      newValue: {
        module: feedback.module,
        category: feedback.category,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/qa");
    revalidatePath("/dashboard/security");
    return { success: true, message: "Feedback berhasil dikirim ke admin." };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Gagal mengirim feedback.") };
  }
}

export async function updateSystemFeedbackStatusAction(feedbackId: string, status: FeedbackStatus) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "ADMIN") {
    return { success: false, error: "Hanya admin yang dapat mengubah status feedback." };
  }

  try {
    await prisma.systemFeedback.update({
      where: { id: feedbackId },
      data: { status },
    });

    await AuditService.log({
      userId: sessionUser.id,
      action: "UPDATE_SYSTEM_FEEDBACK_STATUS",
      entity: "SystemFeedback",
      entityId: feedbackId,
      newValue: { status },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/qa");
    revalidatePath("/dashboard/security");
    return { success: true, message: "Status feedback berhasil diperbarui." };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Gagal memperbarui status feedback.") };
  }
}

export async function updateFeedbackAttachmentAction(feedbackId: string, newText: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;

  try {
    const feedback = await prisma.systemFeedback.findUnique({ where: { id: feedbackId } });
    if (!feedback) {
      return { success: false, error: "Feedback tidak ditemukan." };
    }

    if (feedback.submittedById !== sessionUser.id && sessionUser.role !== "ADMIN") {
      return { success: false, error: "Anda tidak memiliki wewenang untuk mengubah berkas ini." };
    }

    const marker = "---ATTACHMENT_START---";
    if (!feedback.message.includes(marker)) {
      return { success: false, error: "Feedback ini tidak memiliki lampiran berkas." };
    }

    const parts = feedback.message.split(marker);
    const mainMessage = parts[0].trim();
    const rest = parts[1] || "";
    const nameMatch = rest.match(/NAME:\s*(.*?)\n/);
    const nameClean = nameMatch ? nameMatch[1].trim() : "document.txt";
    const newBase64 = Buffer.from(newText, "utf-8").toString("base64");

    const newMessage = `${mainMessage}\n\n${marker}\nNAME: ${nameClean}\nDATA: ${newBase64}\n---ATTACHMENT_END---`;

    const updated = await prisma.systemFeedback.update({
      where: { id: feedbackId },
      data: {
        message: newMessage,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/qa");
    revalidatePath("/dashboard/security");
    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (error: any) {
    return { success: false, error: "Gagal memperbarui berkas." };
  }
}

export async function submitFeedbackDraftChangesAction(module: FeedbackModule, draftsJson: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;

  try {
    await prisma.auditLog.create({
      data: {
        userId: sessionUser.id,
        action: "SUBMIT_DRAFT_FEEDBACK_CHANGES",
        entity: `FeedbackDraftBatch_${module}`,
        entityId: `BATCH_${Date.now()}`,
        newValue: {
          drafts: draftsJson,
          module,
          submittedAt: new Date().toISOString(),
          status: "DRAFT_PENDING",
        },
      },
    });

    revalidatePath(`/dashboard/${module.toLowerCase()}`);
    return { success: true, message: "Draft perubahan feedback berhasil diajukan ke Admin untuk pengesahan." };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Gagal mengajukan draft perubahan feedback.") };
  }
}

export async function getPendingFeedbackDraftChangesAction(module: FeedbackModule) {
  try {
    const lastBatch = await prisma.auditLog.findFirst({
      where: {
        entity: `FeedbackDraftBatch_${module}`,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!lastBatch || !lastBatch.newValue) {
      return { success: true, status: "NONE", drafts: "[]" };
    }

    const val = lastBatch.newValue as any;
    return {
      success: true,
      status: val.status || "NONE",
      drafts: val.drafts || "[]",
      submittedAt: val.submittedAt,
    };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Gagal memuat status draft feedback.") };
  }
}

export async function ratifyFeedbackDraftChangesAction(module: FeedbackModule, approved: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "ADMIN") {
    return { success: false, error: "Hanya Admin yang dapat mengesahkan draft perubahan feedback." };
  }

  try {
    const lastBatch = await prisma.auditLog.findFirst({
      where: {
        entity: `FeedbackDraftBatch_${module}`,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!lastBatch || !lastBatch.newValue) {
      return { success: false, error: "Tidak ada permohonan draft perubahan feedback yang menggantung." };
    }

    const val = lastBatch.newValue as any;
    const drafts: any[] = JSON.parse(val.drafts || "[]");
    const ratifiedAt = new Date().toISOString();

    if (approved && drafts.length > 0) {
      for (const draft of drafts) {
        const fb = await prisma.systemFeedback.findUnique({ where: { id: draft.id } });
        if (fb) {
          const marker = "---FEEDBACK_REVISIONS_START---";
          let existingRevisions: any[] = [];
          const currentMsg = fb.message || "";

          if (currentMsg.includes(marker)) {
            const parts = currentMsg.split(marker);
            const jsonStr = parts[1]?.split("---FEEDBACK_REVISIONS_END---")[0]?.trim() || "";
            try {
              existingRevisions = JSON.parse(jsonStr);
            } catch (e) {}
          }

          const newRev = {
            revisionNumber: existingRevisions.length + 1,
            editedAt: ratifiedAt,
            requestedAt: val.submittedAt || ratifiedAt,
            processedAt: ratifiedAt,
            ratifiedAt,
            oldStatus: fb.status,
            newStatus: draft.data.status || fb.status,
            oldMessage: currentMsg.split("---FEEDBACK_REVISIONS_START---")[0].trim(),
            newMessage: draft.data.message || currentMsg,
          };

          const updatedRevisions = [...existingRevisions, newRev].slice(-10);
          const cleanMsg = (draft.data.message || currentMsg).split("---FEEDBACK_REVISIONS_START---")[0].trim();
          const finalMsgWithRev = `${cleanMsg}\n\n---FEEDBACK_REVISIONS_START---\n${JSON.stringify(
            updatedRevisions
          )}\n---FEEDBACK_REVISIONS_END---`;

          await prisma.systemFeedback.update({
            where: { id: draft.id },
            data: {
              status: draft.data.status || fb.status,
              message: finalMsgWithRev,
            },
          });
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: sessionUser.id,
        action: approved ? "RATIFY_DRAFT_FEEDBACK_CHANGES" : "REJECT_DRAFT_FEEDBACK_CHANGES",
        entity: `FeedbackDraftBatch_${module}`,
        entityId: `BATCH_${Date.now()}`,
        newValue: {
          drafts: "[]",
          module,
          status: approved ? "RATIFIED" : "REJECTED",
          ratifiedAt,
        },
      },
    });

    revalidatePath(`/dashboard/${module.toLowerCase()}`);
    return {
      success: true,
      message: approved ? "Draft perubahan feedback disahkan & diterapkan secara resmi." : "Permohonan draft perubahan feedback ditolak.",
    };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Gagal mengesahkan draft feedback.") };
  }
}

export async function undoFeedbackRevisionAction(feedbackId: string, revisionNumber: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "ADMIN") {
    return { success: false, error: "Hanya Admin yang dapat memulihkan revisi feedback sebelumnya." };
  }

  try {
    const fb = await prisma.systemFeedback.findUnique({ where: { id: feedbackId } });
    if (!fb) return { success: false, error: "Feedback tidak ditemukan." };

    const marker = "---FEEDBACK_REVISIONS_START---";
    if (!fb.message.includes(marker)) {
      return { success: false, error: "Tidak ada riwayat revisi untuk dipulihkan." };
    }

    const parts = fb.message.split(marker);
    const jsonStr = parts[1]?.split("---FEEDBACK_REVISIONS_END---")[0]?.trim() || "";
    const revisions: any[] = JSON.parse(jsonStr);

    const targetRev = revisions.find((r) => r.revisionNumber === revisionNumber);
    if (!targetRev) return { success: false, error: "Versi revisi tidak ditemukan." };

    await prisma.systemFeedback.update({
      where: { id: feedbackId },
      data: {
        status: targetRev.oldStatus,
        message: targetRev.oldMessage,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/qa");
    revalidatePath("/dashboard/security");
    return { success: true, message: `Feedback berhasil dipulihkan ke versi revisi #${revisionNumber}.` };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Gagal memulihkan revisi feedback.") };
  }
}
