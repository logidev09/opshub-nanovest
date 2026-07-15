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
  try {
    const result = await HrService.requestLeave(userId, data);
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
