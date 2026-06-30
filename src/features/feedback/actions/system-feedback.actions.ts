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

    const feedback = await prisma.systemFeedback.create({
      data: {
        module: input.module,
        category: input.category,
        message,
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
