import { HrRepository } from "../repositories/hr.repository";
import { AuditService } from "@/features/audit/services/audit.service";
import { LeaveStatus, LeaveType } from "@prisma/client";

/**
 * Generates a deterministic mock vector of 1024 dimensions.
 * Ensures the pgvector similarity syntax is functional offline/without API keys.
 */
export function getMockEmbedding(text: string): number[] {
  const vector = new Array(1024).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  for (let j = 0; j < 1024; j++) {
    vector[j] = Math.sin(hash + j) * 0.1;
  }
  return vector;
}

/**
 * Fetches text embedding from Hugging Face (BAAI/bge-m3) or falls back to mock.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
  if (hfToken) {
    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/pipeline/feature-extraction/BAAI/bge-m3",
        {
          headers: {
            Authorization: `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify({ inputs: text }),
        }
      );
      const result = await response.json();
      if (Array.isArray(result) && result.length > 0) {
        // If nested array returned, flatten it
        const flatResult = Array.isArray(result[0]) ? result[0] : result;
        if (flatResult.length === 1024) {
          return flatResult;
        }
      }
    } catch (e) {
      console.warn("[HrService] Hugging Face extraction failed, using mock embeddings:", e);
    }
  }

  return getMockEmbedding(text);
}

export class HrService {
  /**
   * Retrieves context from database policies using vector similarity search.
   */
  static async getRagContext(prompt: string, isFinance = false): Promise<{ context: string; matchedCount: number }> {
    const vector = await getEmbedding(prompt);
    const policies = await HrRepository.searchPolicies(vector, 2, isFinance);

    if (policies.length === 0) {
      return { context: "No policies found matching the query.", matchedCount: 0 };
    }

    const context = policies
      .map((p) => `Policy: ${p.title} (${p.category})\nContent: ${p.content}`)
      .join("\n\n");

    return { context, matchedCount: policies.length };
  }

  /**
   * Handles leave requests validations and saves to DB.
   */
  static async requestLeave(
    userId: string,
    data: {
      type: LeaveType;
      startDate: string;
      endDate: string;
      reason?: string;
      attachmentName?: string;
      attachmentData?: string;
    }
  ) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Format tanggal mulai atau selesai tidak valid.");
    }

    if (start > end) {
      throw new Error("Tanggal mulai tidak boleh melewati tanggal selesai.");
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const requestedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const overlappingRequest = await HrRepository.findOverlappingLeaveRequests(userId, start, end);
    if (overlappingRequest) {
      throw new Error("Sudah ada pengajuan cuti lain yang bertumpang tindih pada rentang tanggal tersebut.");
    }

    if (data.type === LeaveType.ANNUAL) {
      const currentBalance = await HrRepository.getLeaveBalance(userId);
      if (requestedDays > currentBalance) {
        throw new Error(`Sisa cuti tidak mencukupi. Anda meminta ${requestedDays} hari, sedangkan sisa cuti saat ini ${currentBalance} hari.`);
      }
    }

    let finalReason = data.reason || "";
    if (data.attachmentName && data.attachmentData) {
      finalReason = `${finalReason}\n\n---ATTACHMENT_START---\nNAME: ${data.attachmentName}\nDATA: ${data.attachmentData}\n---ATTACHMENT_END---`;
    }

    const leaveRequest = await HrRepository.createLeaveRequest({
      userId,
      type: data.type,
      startDate: start,
      endDate: end,
      reason: finalReason || undefined,
    });

    // Write Centralized Audit Log
    await AuditService.log({
      userId,
      action: "CREATE_LEAVE",
      entity: "LeaveRequest",
      entityId: leaveRequest.id,
      newValue: {
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        requestedDays,
      },
    });

    return leaveRequest;
  }

  /**
   * Approves or Rejects a leave request.
   */
  static async reviewLeave(leaveId: string, status: LeaveStatus, approverId: string) {
    if (status !== LeaveStatus.APPROVED && status !== LeaveStatus.REJECTED) {
      throw new Error("Invalid review status. Must be APPROVED or REJECTED.");
    }

    const updatedLeave = await HrRepository.updateLeaveRequestStatus(leaveId, status, approverId);

    // Audit log
    await AuditService.log({
      userId: approverId,
      action: `REVIEW_LEAVE_${status}`,
      entity: "LeaveRequest",
      entityId: leaveId,
      newValue: { status },
    });

    return updatedLeave;
  }
}
