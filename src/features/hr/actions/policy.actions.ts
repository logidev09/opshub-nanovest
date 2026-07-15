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

export async function createPolicyAction(data: {
  title: string;
  content: string;
  category: string;
  attachmentName?: string;
  attachmentData?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "HR" && sessionUser.role !== "ADMIN") {
    return { success: false, error: "Hanya Admin dan HR yang dapat menambah dokumen kebijakan." };
  }

  const title = data.title.trim();
  const content = data.content.trim();
  const category = data.category.trim();

  if (!title || !content || !category) {
    return { success: false, error: "Judul, konten, dan kategori wajib diisi." };
  }

  try {
    const newPolicy = await prisma.hrPolicy.create({
      data: {
        title,
        content,
        category,
        metadata: {
          version: "1.0",
          createdBy: sessionUser.id,
          attachmentName: data.attachmentName || null,
          attachmentData: data.attachmentData || null,
        },
      },
    });

    await AuditService.log({
      userId: sessionUser.id,
      action: "CREATE_POLICY",
      entity: "HrPolicy",
      entityId: newPolicy.id,
      newValue: { title, content, category },
    });

    revalidatePath("/dashboard/hr");
    revalidatePath("/dashboard/hr/policies");

    return { success: true, data: newPolicy, message: "Dokumen kebijakan berhasil ditambahkan!" };
  } catch (error: any) {
    console.error("[PolicyActions] Error creating policy:", error);
    return { success: false, error: "Gagal menambahkan dokumen kebijakan." };
  }
}

export async function deletePolicyAction(id: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "HR" && sessionUser.role !== "ADMIN") {
    return { success: false, error: "Hanya Admin dan HR yang dapat menghapus dokumen kebijakan." };
  }

  try {
    const oldPolicy = await prisma.hrPolicy.findUnique({
      where: { id },
    });

    if (!oldPolicy) {
      return { success: false, error: "Dokumen kebijakan tidak ditemukan." };
    }

    await prisma.hrPolicy.delete({
      where: { id },
    });

    await AuditService.log({
      userId: sessionUser.id,
      action: "DELETE_POLICY",
      entity: "HrPolicy",
      entityId: id,
      oldValue: oldPolicy
        ? { title: oldPolicy.title, content: oldPolicy.content, category: oldPolicy.category }
        : null,
    });

    revalidatePath("/dashboard/hr");
    revalidatePath("/dashboard/hr/policies");

    return { success: true, message: "Dokumen kebijakan berhasil dihapus!" };
  } catch (error: any) {
    console.error("[PolicyActions] Error deleting policy:", error);
    return { success: false, error: "Gagal menghapus dokumen kebijakan." };
  }
}

import { generateText } from "ai";
import { chatModel, hasGroqKey } from "@/features/hr/services/ai-provider";

export async function extractDocumentTextAction(fileBase64: string, fileName: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "HR" && sessionUser.role !== "ADMIN") {
    return { success: false, error: "Hanya Admin dan HR yang dapat mengunggah RAG." };
  }

  try {
    const buffer = Buffer.from(fileBase64, "base64");
    let rawText = "";

    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "txt") {
      rawText = buffer.toString("utf-8");
    } else if (ext === "pdf") {
      const content = buffer.toString("binary");
      const matches = content.match(/\((.*?)\)\s*Tj/g);
      if (matches) {
        rawText = matches
          .map((m) =>
            m
              .replace(/^\(/, "")
              .replace(/\)\s*Tj$/, "")
              .replace(/\\([0-3][0-7]{2})/g, (_, octal) =>
                String.fromCharCode(parseInt(octal, 8))
              )
          )
          .join(" ");
      } else {
        rawText = content.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ");
      }
    } else if (ext === "docx" || fileName.endsWith(".docx")) {
      const content = buffer.toString("binary");
      const matches = content.match(/<w:t.*?>(.*?)<\/w:t>/g);
      if (matches) {
        rawText = matches.map((m) => m.replace(/<w:t.*?>/, "").replace(/<\/w:t>/, "")).join(" ");
      } else {
        rawText = content.replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ");
      }
    } else {
      return { success: false, error: "Format file tidak didukung. Harap gunakan PDF, TXT, atau DOCX." };
    }

    rawText = rawText.trim().substring(0, 15000);

    if (!rawText) {
      return { success: false, error: "Teks dokumen kosong atau tidak dapat diekstraksi." };
    }

    let title = fileName.replace(/\.[^/.]+$/, "");
    let category = "regulation";
    let formattedContent = rawText;

    if (hasGroqKey) {
      const prompt = `Anda adalah asisten HR ahli Hukum Ketenagakerjaan Republik Indonesia.
Tolong ekstrak, perbaiki format, dan ringkas teks berikut menjadi dokumen kebijakan HR resmi berdasarkan Peraturan Ketenagakerjaan Republik Indonesia Terbaru Juli 2026.
Teks dokumen mentah:
"""
${rawText}
"""

Berikan respon Anda hanya dalam format JSON mentah (raw JSON) berikut:
{
  "title": "Judul Kebijakan Resmi",
  "category": "leave atau payroll atau onboarding atau regulation",
  "content": "Isi dokumen kebijakan lengkap dalam bahasa Indonesia menggunakan format teks raw yang rapi."
}`;

      const { text } = await generateText({
        model: chatModel,
        prompt,
      });

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          title = parsed.title || title;
          category = parsed.category || category;
          formattedContent = parsed.content || formattedContent;
        }
      } catch (err) {
        console.error("Failed to parse Groq response JSON:", err);
      }
    } else {
      formattedContent = `[MOCK - GROQ API KEY BELUM DIKONFIGURASI]\n\nDokumen: ${title}\n\nKebijakan HR resmi Nanovest disesuaikan dengan UU Ketenagakerjaan RI Juli 2026:\n\n1. Aturan Kerja & Ketentuan Pokok:\nSetiap karyawan tunduk pada jam kerja reguler yang diatur berdasarkan hukum ketenagakerjaan RI terbaru yaitu 40 jam seminggu.\n\n2. Hak Cuti & Istirahat:\nCuti tahunan minimal 12 hari kerja. Istirahat melahirkan 3 bulan dibayar penuh. Uang lembur dihitung berdasarkan aturan proporsional upah per jam.\n\n3. Pengawasan RAG:\nKonten ini diimpor dari file ${fileName} pada tanggal ${new Date().toLocaleDateString("id-ID")}.`;
    }

    return {
      success: true,
      data: {
        title,
        category,
        content: formattedContent,
      },
    };
  } catch (error: any) {
    console.error("Error extracting document:", error);
    return { success: false, error: "Gagal memproses dokumen dengan Groq LLM." };
  }
}

export async function updatePolicyAttachmentAction(policyId: string, newText: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "HR" && sessionUser.role !== "ADMIN") {
    return { success: false, error: "Akses ditolak." };
  }

  try {
    const policy = await prisma.hrPolicy.findUnique({ where: { id: policyId } });
    if (!policy) {
      return { success: false, error: "Dokumen tidak ditemukan." };
    }

    const currentMetadata = (policy.metadata as any) || {};
    const newBase64 = Buffer.from(newText, "utf-8").toString("base64");

    const updated = await prisma.hrPolicy.update({
      where: { id: policyId },
      data: {
        metadata: {
          ...currentMetadata,
          attachmentData: newBase64,
          editedAt: new Date().toISOString(),
        },
      },
    });

    revalidatePath("/dashboard/hr");
    revalidatePath("/dashboard/hr/policies");
    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (error: any) {
    return { success: false, error: "Gagal memperbarui berkas." };
  }
}
