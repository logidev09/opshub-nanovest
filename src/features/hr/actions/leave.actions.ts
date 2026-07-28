"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { HrService } from "../services/hr.service";
import { HrRepository } from "../repositories/hr.repository";
import { LeaveStatus, LeaveType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/features/shared/lib/db";

type SessionUser = {
  id: string;
  role?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function submitLeaveAction(data: {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
  attachmentName?: string;
  attachmentData?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const user = session.user as SessionUser;
  const userId = user.id;
  const isAutoApprove = user.role === "HR" || user.role === "ADMIN";
  try {
    const result = await HrService.requestLeave(userId, data, isAutoApprove);
    revalidatePath("/dashboard/hr");
    revalidatePath("/dashboard");
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Gagal mengirim pengajuan cuti.") };
  }
}

export async function reviewLeaveAction(leaveId: string, status: LeaveStatus) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const user = session.user as SessionUser;
  const role = user.role;
  if (role !== "ADMIN" && role !== "HR") {
    return { success: false, error: "Akses ditolak: Anda tidak memiliki izin untuk meninjau pengajuan cuti." };
  }

  const approverId = user.id;
  try {
    const result = await HrService.reviewLeave(leaveId, status, approverId);
    revalidatePath("/dashboard/hr");
    revalidatePath("/dashboard");
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Gagal memproses pengajuan cuti.") };
  }
}

export async function getLeaveBalanceAction() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return 0;
  }
  const user = session.user as SessionUser;
  const userId = user.id;
  return HrRepository.getLeaveBalance(userId);
}

export async function cancelLeaveAction(leaveId: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const user = session.user as SessionUser;
  try {
    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
    });

    if (!leave) {
      return { success: false, error: "Pengajuan cuti tidak ditemukan." };
    }

    if (leave.userId !== user.id && user.role !== "ADMIN") {
      return { success: false, error: "Anda hanya dapat membatalkan pengajuan cuti milik sendiri." };
    }

    const result = await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: LeaveStatus.CANCELLED,
        approvedBy: user.id,
        approvedAt: new Date(),
      },
    });

    revalidatePath("/dashboard/hr");
    revalidatePath("/dashboard");
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Gagal membatalkan pengajuan cuti.") };
  }
}

export async function updateLeaveAttachmentAction(leaveId: string, newText: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const user = session.user as SessionUser;
  try {
    const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
    if (!leave) {
      return { success: false, error: "Pengajuan cuti tidak ditemukan." };
    }

    if (leave.userId !== user.id && user.role !== "ADMIN" && user.role !== "HR") {
      return { success: false, error: "Anda tidak memiliki wewenang untuk mengubah berkas ini." };
    }

    const reasonStr = leave.reason || "";
    const marker = "---ATTACHMENT_START---";
    if (!reasonStr.includes(marker)) {
      return { success: false, error: "Pengajuan ini tidak memiliki lampiran berkas." };
    }

    const parts = reasonStr.split(marker);
    const mainReason = parts[0].trim();
    const rest = parts[1] || "";
    const nameMatch = rest.match(/NAME:\s*(.*?)\n/);
    const nameClean = nameMatch ? nameMatch[1].trim() : "document.txt";
    const newBase64 = Buffer.from(newText, "utf-8").toString("base64");

    const newReason = `${mainReason}\n\n${marker}\nNAME: ${nameClean}\nDATA: ${newBase64}\n---ATTACHMENT_END---`;

    const updated = await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        reason: newReason,
      },
    });

    revalidatePath("/dashboard/hr");
    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Gagal memperbarui berkas.") };
  }
}

export async function requestLeaveStatusChangeAction(leaveId: string, desiredStatus: LeaveStatus, reason: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const user = session.user as SessionUser;
  try {
    const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
    if (!leave) return { success: false, error: "Cuti tidak ditemukan." };

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "REQUEST_LEAVE_STATUS_CHANGE",
        entity: "LeaveStatusPermission",
        entityId: leaveId,
        newValue: {
          leaveId,
          desiredStatus,
          reason,
          requestedAt: new Date().toISOString(),
          requestedBy: user.id,
          status: "PENDING",
        },
      },
    });

    revalidatePath("/dashboard/hr");
    return { success: true, message: "Permohonan izin perubahan status cuti berhasil diajukan ke Admin." };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Gagal mengajukan izin perubahan status cuti.") };
  }
}

export async function approveLeaveStatusChangeAction(leaveId: string, approved: boolean) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const user = session.user as SessionUser;
  if (user.role !== "ADMIN") {
    return { success: false, error: "Hanya Admin yang dapat menyetujui izin perubahan status cuti." };
  }

  try {
    const lastRequest = await prisma.auditLog.findFirst({
      where: { entity: "LeaveStatusPermission", entityId: leaveId, action: "REQUEST_LEAVE_STATUS_CHANGE" },
      orderBy: { createdAt: "desc" },
    });

    if (!lastRequest || !lastRequest.newValue) {
      return { success: false, error: "Tidak ada permohonan perubahan status yang menggantung." };
    }

    const reqData = lastRequest.newValue as any;
    const processedAt = new Date().toISOString();

    if (approved && reqData.desiredStatus) {
      const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
      if (leave) {
        const prevRevisionMarker = "---LEAVE_REVISIONS_START---";
        let existingRevisions: any[] = [];
        const currentReason = leave.reason || "";

        if (currentReason.includes(prevRevisionMarker)) {
          const parts = currentReason.split(prevRevisionMarker);
          const jsonStr = parts[1]?.split("---LEAVE_REVISIONS_END---")[0]?.trim() || "";
          try {
            existingRevisions = JSON.parse(jsonStr);
          } catch (e) {}
        }

        const newRevItem = {
          revisionNumber: existingRevisions.length + 1,
          editedAt: processedAt,
          editedBy: user.id,
          requestedAt: reqData.requestedAt,
          processedAt,
          ratifiedAt: processedAt,
          oldStatus: leave.status,
          newStatus: reqData.desiredStatus,
        };

        const updatedRevisions = [...existingRevisions, newRevItem].slice(-10);
        const cleanBaseReason = currentReason.split("---LEAVE_REVISIONS_START---")[0].trim();
        const newReasonWithRev = `${cleanBaseReason}\n\n---LEAVE_REVISIONS_START---\n${JSON.stringify(
          updatedRevisions
        )}\n---LEAVE_REVISIONS_END---`;

        await prisma.leaveRequest.update({
          where: { id: leaveId },
          data: {
            status: reqData.desiredStatus,
            approvedBy: user.id,
            approvedAt: new Date(),
            reason: newReasonWithRev,
          },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: approved ? "APPROVE_LEAVE_STATUS_CHANGE" : "REJECT_LEAVE_STATUS_CHANGE",
        entity: "LeaveStatusPermission",
        entityId: leaveId,
        newValue: {
          leaveId,
          approved,
          processedAt,
          requestedAt: reqData.requestedAt,
        },
      },
    });

    revalidatePath("/dashboard/hr");
    return {
      success: true,
      message: approved ? "Izin disetujui & status cuti berhasil diperbarui." : "Permohonan perubahan status cuti ditolak.",
    };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Gagal memproses persetujuan status cuti.") };
  }
}

export async function undoLeaveStatusRevisionAction(leaveId: string, revisionNumber: number) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const user = session.user as SessionUser;
  if (user.role !== "ADMIN") {
    return { success: false, error: "Hanya Admin yang dapat memulihkan status cuti sebelumnya." };
  }

  try {
    const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
    if (!leave) return { success: false, error: "Cuti tidak ditemukan." };

    const marker = "---LEAVE_REVISIONS_START---";
    if (!leave.reason || !leave.reason.includes(marker)) {
      return { success: false, error: "Tidak ada riwayat revisi untuk dipulihkan." };
    }

    const parts = leave.reason.split(marker);
    const jsonStr = parts[1]?.split("---LEAVE_REVISIONS_END---")[0]?.trim() || "";
    const revisions: any[] = JSON.parse(jsonStr);

    const targetRev = revisions.find((r) => r.revisionNumber === revisionNumber);
    if (!targetRev) return { success: false, error: "Versi revisi tidak ditemukan." };

    await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: targetRev.oldStatus,
      },
    });

    revalidatePath("/dashboard/hr");
    return { success: true, message: `Status cuti berhasil dipulihkan ke status sebelumnya (${targetRev.oldStatus}).` };
  } catch (err: unknown) {
    return { success: false, error: getErrorMessage(err, "Gagal memulihkan status cuti.") };
  }
}
