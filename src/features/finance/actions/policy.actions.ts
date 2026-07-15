"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/features/shared/lib/db";
import { AuditService } from "@/features/audit/services/audit.service";
import { revalidatePath } from "next/cache";

type SessionUser = {
  id: string;
  role?: string;
  division?: string | null;
};

export async function getFinancePoliciesAction() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  try {
    const policies = await prisma.hrPolicy.findMany({
      where: { category: { startsWith: "finance_" } },
      orderBy: { title: "asc" },
    });
    return { success: true, data: policies };
  } catch (error: any) {
    console.error("[FinancePolicyActions] Error getting policies:", error);
    return { success: false, error: "Gagal memuat dokumen PSAK/IFRS." };
  }
}

export async function updateFinancePolicyAction(
  id: string,
  data: { title: string; content: string; category: string }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "ADMIN" && sessionUser.division !== "Accounting") {
    return { success: false, error: "Hanya Admin dan Accountant yang dapat mengubah dokumen ini." };
  }

  const title = data.title.trim();
  const content = data.content.trim();
  let category = data.category.trim();
  
  if (!category.startsWith("finance_")) {
    category = "finance_" + category;
  }

  if (!title || !content) {
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

    await AuditService.log({
      userId: sessionUser.id,
      action: "UPDATE_FINANCE_POLICY",
      entity: "HrPolicy",
      entityId: id,
      oldValue: oldPolicy
        ? { title: oldPolicy.title, content: oldPolicy.content, category: oldPolicy.category }
        : null,
      newValue: { title: updatedPolicy.title, content: updatedPolicy.content, category: updatedPolicy.category },
    });

    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/finance/policies");

    return { success: true, data: updatedPolicy, message: "Dokumen berhasil diperbarui!" };
  } catch (error: any) {
    console.error("[FinancePolicyActions] Error updating policy:", error);
    return { success: false, error: "Gagal memperbarui dokumen." };
  }
}

export async function createFinancePolicyAction(data: {
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
  if (sessionUser.role !== "ADMIN" && sessionUser.division !== "Accounting") {
    return { success: false, error: "Hanya Admin dan Accountant yang dapat menambah dokumen." };
  }

  const title = data.title.trim();
  const content = data.content.trim();
  let category = data.category.trim();

  if (!category.startsWith("finance_")) {
    category = "finance_" + category;
  }

  if (!title || !content) {
    return { success: false, error: "Judul dan konten wajib diisi." };
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
      action: "CREATE_FINANCE_POLICY",
      entity: "HrPolicy",
      entityId: newPolicy.id,
      newValue: { title, content, category },
    });

    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/finance/policies");

    return { success: true, data: newPolicy, message: "Dokumen berhasil ditambahkan!" };
  } catch (error: any) {
    console.error("[FinancePolicyActions] Error creating policy:", error);
    return { success: false, error: "Gagal menambahkan dokumen." };
  }
}

export async function deleteFinancePolicyAction(id: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "ADMIN" && sessionUser.division !== "Accounting") {
    return { success: false, error: "Hanya Admin dan Accountant yang dapat menghapus dokumen." };
  }

  try {
    const oldPolicy = await prisma.hrPolicy.findUnique({
      where: { id },
    });

    if (!oldPolicy) {
      return { success: false, error: "Dokumen tidak ditemukan." };
    }

    await prisma.hrPolicy.delete({
      where: { id },
    });

    await AuditService.log({
      userId: sessionUser.id,
      action: "DELETE_FINANCE_POLICY",
      entity: "HrPolicy",
      entityId: id,
      oldValue: oldPolicy
        ? { title: oldPolicy.title, content: oldPolicy.content, category: oldPolicy.category }
        : null,
    });

    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/finance/policies");

    return { success: true, message: "Dokumen berhasil dihapus!" };
  } catch (error: any) {
    console.error("[FinancePolicyActions] Error deleting policy:", error);
    return { success: false, error: "Gagal menghapus dokumen." };
  }
}

import { generateText } from "ai";
import { chatModel, hasGroqKey } from "@/features/hr/services/ai-provider";

export async function extractFinanceDocumentTextAction(fileBase64: string, fileName: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "ADMIN" && sessionUser.division !== "Accounting") {
    return { success: false, error: "Hanya Admin dan Accountant yang dapat mengunggah dokumen." };
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
    let category = "finance_tax";
    let formattedContent = rawText;

    if (hasGroqKey) {
      const prompt = `Anda adalah asisten keuangan ahli PSAK/IFRS dan Hukum Perpajakan Republik Indonesia per Juli 2026.
Tolong ringkas, perbaiki format, dan kategorikan teks berikut menjadi dokumen standar/pedoman resmi keuangan.
Teks dokumen mentah:
"""
${rawText}
"""

Berikan respon Anda hanya dalam format JSON mentah (raw JSON) berikut:
{
  "title": "Judul Pedoman/Regulasi Keuangan Resmi",
  "category": "salah satu dari: finance_psak, finance_ifrs, finance_tax, finance_regulation",
  "content": "Isi dokumen pedoman lengkap dalam bahasa Indonesia menggunakan format teks raw yang rapi."
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
      formattedContent = `[MOCK - GROQ API KEY BELUM DIKONFIGURASI]\n\nPedoman Keuangan: ${title}\n\nKebijakan Keuangan disesuaikan dengan PSAK / IFRS & UU Perpajakan RI Juli 2026:\n\n1. Aturan Pengakuan Pendapatan (PSAK 72 / IFRS 15):\nPendapatan diakui saat kewajiban kinerja dipenuhi dengan mentransfer barang atau jasa yang dijanjikan ke pelanggan.\n\n2. Ketentuan Pajak Tangguhan & PPN Terbaru (Juli 2026):\nPerhitungan PPN terutang wajib divalidasi dan dilaporkan secara real-time. Cadangan kerugian piutang harus memenuhi kriteria PSAK untuk pengakuan beban pajak tangguhan.\n\n3. Pengawasan RAG:\nKonten ini diimpor dari file ${fileName} pada tanggal ${new Date().toLocaleDateString("id-ID")}.`;
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
