import { prisma } from "@/features/shared/lib/db";

interface AuditLogPayload {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  static async log(payload: AuditLogPayload) {
    try {
      const logEntry = await prisma.auditLog.create({
        data: {
          userId: payload.userId || null,
          action: payload.action,
          entity: payload.entity,
          entityId: payload.entityId,
          oldValue: payload.oldValue ? JSON.parse(JSON.stringify(payload.oldValue)) : null,
          newValue: payload.newValue ? JSON.parse(JSON.stringify(payload.newValue)) : null,
          ipAddress: payload.ipAddress || null,
          userAgent: payload.userAgent || null,
        },
      });
      console.log(`[AuditLog] Log created successfully: ${logEntry.id} - Action: ${logEntry.action}`);
      return logEntry;
    } catch (error) {
      console.error("[AuditLog] Failed to write audit log:", error);
    }
  }

  static async getLogs(filters?: { userId?: string; entity?: string; limit?: number }) {
    return prisma.auditLog.findMany({
      where: {
        userId: filters?.userId,
        entity: filters?.entity,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: filters?.limit ?? 50,
    });
  }
}
