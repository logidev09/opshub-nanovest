"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/features/shared/lib/db";
import { AuditService } from "@/features/audit/services/audit.service";
import { revalidatePath } from "next/cache";

type SessionUser = {
  id: string;
  role?: string;
};

export async function getPoliciesAction() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  try {
    const policies = await prisma.hrPolicy.findMany({
      orderBy: { title: "asc" },
    });
    return { success: true, data: policies };
  } catch (error: any) {
    console.error("[PolicyActions] Error getting policies:", error);
    return { success: false, error: "Gagal memuat dokumen kebijakan." };
  }
}

export async function updatePolicyAction(
  id: string,
  data: { title: string; content: string; category: string }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "HR" && sessionUser.role !== "ADMIN") {
    return { success: false, error: "Hanya Admin dan HR yang dapat mengubah dokumen kebijakan." };
  }

  const title = data.title.trim();
  const content = data.content.trim();
  const category = data.category.trim();

  if (!title || !content || !category) {
    return { success: false, error: "Judul, konten, dan kategori wajib diisi." };
  }

  try {
    const oldPolicy = await prisma.hrPolicy.findUnique({
      where: { id },
    });

    const updatedPolicy = await prisma.hrPolicy.update({
      where: { id },
      data: {
        title,
        content,
        category,
        metadata: {
          updatedBy: sessionUser.id,
          version: String(
            Number((oldPolicy?.metadata as any)?.version || "1.0") + 0.1
          ),
        },
      },
    });

    // Write audit log
    await AuditService.log({
      userId: sessionUser.id,
      action: "UPDATE_POLICY",
      entity: "HrPolicy",
      entityId: id,
      oldValue: oldPolicy
        ? { title: oldPolicy.title, content: oldPolicy.content, category: oldPolicy.category }
        : null,
      newValue: { title: updatedPolicy.title, content: updatedPolicy.content, category: updatedPolicy.category },
    });

    revalidatePath("/dashboard/hr");
    revalidatePath("/dashboard/hr/policies");

    return { success: true, data: updatedPolicy, message: "Dokumen kebijakan berhasil diperbarui!" };
  } catch (error: any) {
    console.error("[PolicyActions] Error updating policy:", error);
    return { success: false, error: "Gagal memperbarui dokumen kebijakan." };
  }
}
