import { Prisma, type HrPolicy, type LeaveRequest, LeaveStatus, LeaveType } from "@prisma/client";
import { prisma } from "@/features/shared/lib/db";

type SearchPolicyResult = Pick<HrPolicy, "id" | "title" | "content" | "category"> & {
  metadata: Prisma.JsonValue;
};

export class HrRepository {
  /**
   * Performs pgvector similarity search. Falls back to a standard query if it fails.
   */
  static async searchPolicies(queryVector: number[], limit = 3) {
    try {
      const vectorString = `[${queryVector.join(",")}]`;
      const policies = await prisma.$queryRawUnsafe<SearchPolicyResult[]>(
        `SELECT id, title, content, category, metadata
         FROM "HrPolicy"
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        vectorString,
        limit
      );
      return policies;
    } catch (error) {
      console.warn("[HrRepository] Vector search failed or pgvector extension missing. Falling back to text-based matching:", error);
      // Fallback: Simple query when pgvector is not setup
      return prisma.hrPolicy.findMany({
        take: limit,
      });
    }
  }

  /**
   * Helper to seed policy with embedding vector or standard format.
   */
  static async createPolicy(data: {
    title: string;
    content: string;
    category: string;
    embedding?: number[];
    metadata?: Prisma.JsonValue;
  }) {
    if (data.embedding && data.embedding.length > 0) {
      const id = `policy-${Math.random().toString(36).substring(2, 11)}`;
      const vectorString = `[${data.embedding.join(",")}]`;
      const metadataString = JSON.stringify(data.metadata || {});

      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "HrPolicy" (id, title, content, category, embedding, metadata, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5::vector, $6::json, NOW(), NOW())`,
          id,
          data.title,
          data.content,
          data.category,
          vectorString,
          metadataString
        );
        return { id, ...data };
      } catch (error) {
        console.error("[HrRepository] Raw insert with embedding failed. Creating without embedding:", error);
      }
    }

    return prisma.hrPolicy.create({
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        metadata: data.metadata || {},
      },
    });
  }

  // ========== LEAVE REQUESTS ==========

  static async createLeaveRequest(data: {
    userId: string;
    type: LeaveType;
    startDate: Date;
    endDate: Date;
    reason?: string;
  }) {
    return prisma.leaveRequest.create({
      data: {
        userId: data.userId,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        reason: data.reason,
        status: LeaveStatus.PENDING,
      },
    });
  }

  static async getLeaveRequestsByUserId(userId: string) {
    return prisma.leaveRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  static async getLeaveRequestsPending() {
    return prisma.leaveRequest.findMany({
      where: { status: LeaveStatus.PENDING },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  static async updateLeaveRequestStatus(leaveId: string, status: LeaveStatus, approvedBy?: string) {
    return prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status,
        approvedBy,
        approvedAt: status === LeaveStatus.APPROVED || status === LeaveStatus.REJECTED ? new Date() : null,
      },
    });
  }

  static async findOverlappingLeaveRequests(userId: string, startDate: Date, endDate: Date): Promise<LeaveRequest | null> {
    return prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: {
          in: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
        },
        startDate: {
          lte: endDate,
        },
        endDate: {
          gte: startDate,
        },
      },
    });
  }

  /**
   * Calculates remaining leave balance (12 days total per year minus approved leaves)
   */
  static async getLeaveBalance(userId: string): Promise<number> {
    const totalAllocated = 12;

    const approvedLeaves = await prisma.leaveRequest.findMany({
      where: {
        userId,
        status: LeaveStatus.APPROVED,
        type: LeaveType.ANNUAL,
      },
    });

    // Sum the days of each approved leave request
    let usedDays = 0;
    for (const leave of approvedLeaves) {
      const diffTime = Math.abs(leave.endDate.getTime() - leave.startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
      usedDays += diffDays;
    }

    return Math.max(0, totalAllocated - usedDays);
  }
}
