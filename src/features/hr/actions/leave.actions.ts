"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { HrService } from "../services/hr.service";
import { HrRepository } from "../repositories/hr.repository";
import { LeaveStatus, LeaveType } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function submitLeaveAction(data: {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized access." };
  }

  const userId = (session.user as any).id;
  try {
    const result = await HrService.requestLeave(userId, data);
    revalidatePath("/dashboard/hr");
    revalidatePath("/dashboard");
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to submit leave request." };
  }
}

export async function reviewLeaveAction(leaveId: string, status: LeaveStatus) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Unauthorized access." };
  }

  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "HR") {
    return { success: false, error: "Forbidden: You do not have permissions to review leave requests." };
  }

  const approverId = (session.user as any).id;
  try {
    const result = await HrService.reviewLeave(leaveId, status, approverId);
    revalidatePath("/dashboard/hr");
    revalidatePath("/dashboard");
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to review leave request." };
  }
}

export async function getLeaveBalanceAction() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return 0;
  }
  const userId = (session.user as any).id;
  return HrRepository.getLeaveBalance(userId);
}
