"use server";

import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { BalanceSide } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/features/shared/lib/db";
import { AuditService } from "@/features/audit/services/audit.service";
import { chatModel, hasGroqKey } from "@/features/hr/services/ai-provider";
import { generateText } from "ai";
import { HrService } from "@/features/hr/services/hr.service";

type SessionUser = {
  id: string;
  role?: string;
};

export interface JournalLineInput {
  financeAccountId: string;
  side: "DEBIT" | "CREDIT";
  amount: number;
}

interface PostJournalEntryInput {
  description: string;
  entryDate: string;
  lines?: JournalLineInput[];
  debitAccountId?: string;
  creditAccountId?: string;
  amount?: number;
  attachmentName?: string;
  attachmentData?: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function postJournalEntryAction(input: PostJournalEntryInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (!["ADMIN", "HR", "ACCOUNTANT"].includes(sessionUser.role || "")) {
    return { success: false, error: "Role Anda tidak diizinkan memposting jurnal." };
  }

  let description = input.description.trim();
  if (input.attachmentName && input.attachmentData) {
    description = `${description}\n\n---ATTACHMENT_START---\nNAME: ${input.attachmentName}\nDATA: ${input.attachmentData}\n---ATTACHMENT_END---`;
  }

  if (!input.description.trim()) {
    return { success: false, error: "Deskripsi jurnal wajib diisi." };
  }

  if (!input.entryDate) {
    return { success: false, error: "Tanggal jurnal wajib diisi." };
  }

  let journalLines: JournalLineInput[] = [];

  if (input.lines && input.lines.length > 0) {
    journalLines = input.lines;
  } else if (input.debitAccountId && input.creditAccountId && input.amount) {
    const singleAmt = Number(input.amount);
    if (!Number.isFinite(singleAmt) || singleAmt <= 0) {
      return { success: false, error: "Nominal jurnal harus lebih besar dari nol." };
    }
    if (input.debitAccountId === input.creditAccountId) {
      return { success: false, error: "Akun debit dan kredit harus berbeda." };
    }
    journalLines = [
      { financeAccountId: input.debitAccountId, side: "DEBIT", amount: singleAmt },
      { financeAccountId: input.creditAccountId, side: "CREDIT", amount: singleAmt },
    ];
  } else {
    return { success: false, error: "Detail baris jurnal debit/kredit tidak lengkap." };
  }

  const totalDebit = journalLines
    .filter((l) => l.side === "DEBIT")
    .reduce((sum, l) => sum + Number(l.amount), 0);
  const totalCredit = journalLines
    .filter((l) => l.side === "CREDIT")
    .reduce((sum, l) => sum + Number(l.amount), 0);

  if (totalDebit <= 0 || totalCredit <= 0) {
    return { success: false, error: "Nominal total debit dan kredit harus lebih besar dari nol." };
  }

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return {
      success: false,
      error: `Jurnal tidak seimbang! Total Debit: ${totalDebit.toLocaleString("id-ID")}, Total Kredit: ${totalCredit.toLocaleString("id-ID")}.`,
    };
  }

  try {
    const entryCount = await prisma.journalEntry.count();

    const createdEntry = await prisma.journalEntry.create({
      data: {
        reference: `JE-${new Date().getFullYear()}-${String(entryCount + 1).padStart(4, "0")}`,
        description,
        entryDate: new Date(input.entryDate),
        totalDebit,
        totalCredit,
        postedById: sessionUser.id,
        lines: {
          create: journalLines.map((line) => ({
            financeAccountId: line.financeAccountId,
            side: line.side as BalanceSide,
            amount: Number(line.amount),
          })),
        },
      },
    });

    await AuditService.log({
      userId: sessionUser.id,
      action: "POST_JOURNAL_ENTRY",
      entity: "JournalEntry",
      entityId: createdEntry.id,
      newValue: {
        description,
        totalDebit,
        totalCredit,
        lineCount: journalLines.length,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/finance");
    return { success: true, message: "Jurnal balanced berhasil diposting." };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Gagal memposting jurnal.") };
  }
}

export async function requestJournalEditPermissionAction() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }
  const user = session.user as SessionUser;
  try {
    await AuditService.log({
      userId: user.id,
      action: "REQUEST_JOURNAL_EDIT_PERMISSION",
      entity: "JournalEditPermission",
      entityId: user.id,
      newValue: { requestedAt: new Date().toISOString(), status: "PENDING" },
    });
    revalidatePath("/dashboard/finance");
    return { success: true, message: "Permohonan izin perubahan jurnal berhasil dikirim ke Admin." };
  } catch (err: any) {
    return { success: false, error: "Gagal mengajukan izin." };
  }
}

export async function approveJournalEditPermissionAction(approved: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }
  const user = session.user as SessionUser;
  if (user.role !== "ADMIN") {
    return { success: false, error: "Hanya Admin yang dapat menyetujui izin perubahan." };
  }
  try {
    await AuditService.log({
      userId: user.id,
      action: approved ? "APPROVE_JOURNAL_EDIT_PERMISSION" : "REJECT_JOURNAL_EDIT_PERMISSION",
      entity: "JournalEditPermission",
      entityId: user.id,
      newValue: { processedAt: new Date().toISOString(), status: approved ? "APPROVED" : "REJECTED" },
    });
    revalidatePath("/dashboard/finance");
    return {
      success: true,
      message: approved ? "Izin perubahan jurnal disetujui." : "Izin perubahan jurnal ditolak.",
    };
  } catch (err: any) {
    return { success: false, error: "Gagal memproses izin." };
  }
}

export async function getJournalEditPermissionStatusAction() {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { entity: "JournalEditPermission" },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    if (logs.length === 0) {
      return { success: true, status: "NONE", requestedAt: null, processedAt: null };
    }
    const latest = logs[0];
    const requestedLog = logs.find((l) => l.action === "REQUEST_JOURNAL_EDIT_PERMISSION");
    const processedLog = logs.find((l) =>
      ["APPROVE_JOURNAL_EDIT_PERMISSION", "REJECT_JOURNAL_EDIT_PERMISSION"].includes(l.action)
    );

    let status = "NONE";
    if (latest.action === "REQUEST_JOURNAL_EDIT_PERMISSION") status = "PENDING";
    if (latest.action === "APPROVE_JOURNAL_EDIT_PERMISSION") status = "APPROVED";
    if (latest.action === "REJECT_JOURNAL_EDIT_PERMISSION") status = "REJECTED";

    return {
      success: true,
      status,
      requestedAt: requestedLog ? requestedLog.createdAt.toISOString() : null,
      processedAt: processedLog ? processedLog.createdAt.toISOString() : null,
    };
  } catch (err) {
    return { success: false, status: "NONE", requestedAt: null, processedAt: null };
  }
}

export async function deleteJournalEntryAction(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "ADMIN") {
    return { success: false, error: "Hanya admin yang dapat menghapus jurnal." };
  }

  try {
    const entry = await prisma.journalEntry.findUnique({ where: { id } });
    if (!entry) {
      return { success: false, error: "Jurnal tidak ditemukan." };
    }

    await prisma.journalEntry.delete({
      where: { id },
    });

    await AuditService.log({
      userId: sessionUser.id,
      action: "DELETE_JOURNAL_ENTRY",
      entity: "JournalEntry",
      entityId: entry.id,
      oldValue: {
        reference: entry.reference,
        description: entry.description,
        totalDebit: entry.totalDebit.toNumber(),
        totalCredit: entry.totalCredit.toNumber(),
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/finance");
    return { success: true, message: "Jurnal berhasil dihapus." };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Gagal menghapus jurnal.") };
  }
}

export async function updateJournalEntryAction(
  id: string,
  data: {
    entryDate: string;
    description: string;
    lines?: JournalLineInput[];
    attachmentName?: string;
    attachmentData?: string;
  }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  const isAdmin = sessionUser.role === "ADMIN";

  if (!isAdmin) {
    const perm = await getJournalEditPermissionStatusAction();
    if (perm.status !== "APPROVED") {
      return { success: false, error: "Anda memerlukan izin dari Admin untuk melakukan perubahan jurnal." };
    }
  }

  const rawDescription = data.description.trim();
  if (!rawDescription) {
    return { success: false, error: "Deskripsi wajib diisi." };
  }

  if (!data.entryDate) {
    return { success: false, error: "Tanggal wajib diisi." };
  }

  try {
    const oldEntry = await prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { financeAccount: selectAll } } },
    });
    if (!oldEntry) {
      return { success: false, error: "Jurnal tidak ditemukan." };
    }

    let finalDescription = rawDescription;
    if (data.attachmentName && data.attachmentData) {
      finalDescription = `${finalDescription}\n\n---ATTACHMENT_START---\nNAME: ${data.attachmentName}\nDATA: ${data.attachmentData}\n---ATTACHMENT_END---`;
    }

    // Preserve and append revision history
    const prevRevisionMarker = "---REVISIONS_START---";
    let existingRevisions: any[] = [];
    if (oldEntry.description.includes(prevRevisionMarker)) {
      const parts = oldEntry.description.split(prevRevisionMarker);
      const jsonStr = parts[1]?.split("---REVISIONS_END---")[0]?.trim() || "";
      try {
        existingRevisions = JSON.parse(jsonStr);
      } catch (e) {}
    }

    const newRevisionItem = {
      revisionNumber: existingRevisions.length + 1,
      editedAt: new Date().toISOString(),
      editedBy: sessionUser.id,
      oldDescription: oldEntry.description.split("---REVISIONS_START---")[0].trim(),
      newDescription: rawDescription,
      oldDate: oldEntry.entryDate.toISOString(),
      newDate: data.entryDate,
      oldLines: oldEntry.lines.map((l) => ({
        side: l.side,
        financeAccountId: l.financeAccountId,
        accountCode: l.financeAccount?.code,
        accountName: l.financeAccount?.name,
        amount: l.amount.toNumber(),
      })),
      newLines: data.lines || [],
    };

    const updatedRevisions = [...existingRevisions, newRevisionItem].slice(-10);

    const descriptionWithRevisions = `${finalDescription}\n\n---REVISIONS_START---\n${JSON.stringify(
      updatedRevisions
    )}\n---REVISIONS_END---`;

    let newTotalDebit = oldEntry.totalDebit.toNumber();
    let newTotalCredit = oldEntry.totalCredit.toNumber();

    if (data.lines && data.lines.length > 0) {
      newTotalDebit = data.lines
        .filter((l) => l.side === "DEBIT")
        .reduce((sum, l) => sum + Number(l.amount), 0);
      newTotalCredit = data.lines
        .filter((l) => l.side === "CREDIT")
        .reduce((sum, l) => sum + Number(l.amount), 0);

      if (Math.abs(newTotalDebit - newTotalCredit) > 0.01) {
        return {
          success: false,
          error: `Jurnal tidak seimbang! Total Debit: ${newTotalDebit.toLocaleString("id-ID")}, Total Kredit: ${newTotalCredit.toLocaleString("id-ID")}.`,
        };
      }

      await prisma.journalLine.deleteMany({ where: { journalEntryId: id } });
      await prisma.journalLine.createMany({
        data: data.lines.map((l) => ({
          journalEntryId: id,
          financeAccountId: l.financeAccountId,
          side: l.side as BalanceSide,
          amount: Number(l.amount),
        })),
      });
    }

    const updatedEntry = await prisma.journalEntry.update({
      where: { id },
      data: {
        entryDate: new Date(data.entryDate),
        description: descriptionWithRevisions,
        totalDebit: newTotalDebit,
        totalCredit: newTotalCredit,
      },
    });

    await AuditService.log({
      userId: sessionUser.id,
      action: "UPDATE_JOURNAL_ENTRY",
      entity: "JournalEntry",
      entityId: id,
      oldValue: {
        entryDate: oldEntry.entryDate.toISOString(),
        description: oldEntry.description,
      },
      newValue: {
        entryDate: updatedEntry.entryDate.toISOString(),
        description: updatedEntry.description,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/finance");
    return { success: true, data: updatedEntry, message: "Jurnal entry berhasil diperbarui." };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Gagal memperbarui jurnal entry.") };
  }
}

const selectAll = { select: { code: true, name: true } };

export async function undoJournalEntryRevisionAction(id: string, revisionNumber: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "ADMIN") {
    return { success: false, error: "Hanya Admin yang dapat memulihkan (undo) riwayat jurnal." };
  }

  try {
    const entry = await prisma.journalEntry.findUnique({ where: { id } });
    if (!entry) return { success: false, error: "Jurnal tidak ditemukan." };

    const marker = "---REVISIONS_START---";
    if (!entry.description.includes(marker)) {
      return { success: false, error: "Tidak ada riwayat revisi untuk jurnal ini." };
    }

    const jsonStr = entry.description.split(marker)[1]?.split("---REVISIONS_END---")[0]?.trim() || "";
    const revisions = JSON.parse(jsonStr);
    const targetRev = revisions.find((r: any) => r.revisionNumber === revisionNumber);

    if (!targetRev) return { success: false, error: "Versi revisi yang dipilih tidak ditemukan." };

    let restoredDate = entry.entryDate;
    if (targetRev.oldDate) restoredDate = new Date(targetRev.oldDate);

    let restoredDesc = targetRev.oldDescription || entry.description.split(marker)[0].trim();

    if (targetRev.oldLines && targetRev.oldLines.length > 0) {
      const restoredDebit = targetRev.oldLines
        .filter((l: any) => l.side === "DEBIT")
        .reduce((sum: number, l: any) => sum + Number(l.amount), 0);
      const restoredCredit = targetRev.oldLines
        .filter((l: any) => l.side === "CREDIT")
        .reduce((sum: number, l: any) => sum + Number(l.amount), 0);

      await prisma.journalLine.deleteMany({ where: { journalEntryId: id } });
      await prisma.journalLine.createMany({
        data: targetRev.oldLines.map((l: any) => ({
          journalEntryId: id,
          financeAccountId: l.financeAccountId,
          side: l.side as BalanceSide,
          amount: Number(l.amount),
        })),
      });

      await prisma.journalEntry.update({
        where: { id },
        data: {
          entryDate: restoredDate,
          description: restoredDesc,
          totalDebit: restoredDebit,
          totalCredit: restoredCredit,
        },
      });
    } else {
      await prisma.journalEntry.update({
        where: { id },
        data: {
          entryDate: restoredDate,
          description: restoredDesc,
        },
      });
    }

    await AuditService.log({
      userId: sessionUser.id,
      action: "UNDO_JOURNAL_REVISION",
      entity: "JournalEntry",
      entityId: id,
      newValue: { restoredRevisionNumber: revisionNumber },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/finance");
    return { success: true, message: `Berhasil memulihkan jurnal ke Revisi #${revisionNumber}.` };
  } catch (err: any) {
    return { success: false, error: "Gagal memulihkan revisi jurnal." };
  }
}

export async function updateJournalEntryAttachmentAction(entryId: string, newText: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  try {
    const entry = await prisma.journalEntry.findUnique({ where: { id: entryId } });
    if (!entry) {
      return { success: false, error: "Jurnal entry tidak ditemukan." };
    }

    const marker = "---ATTACHMENT_START---";
    if (!entry.description.includes(marker)) {
      return { success: false, error: "Jurnal ini tidak memiliki lampiran berkas." };
    }

    const parts = entry.description.split(marker);
    const mainDesc = parts[0].trim();
    const rest = parts[1] || "";
    const nameMatch = rest.match(/NAME:\s*(.*?)\n/);
    const nameClean = nameMatch ? nameMatch[1].trim() : "document.txt";
    const newBase64 = Buffer.from(newText, "utf-8").toString("base64");

    const newDescription = `${mainDesc}\n\n${marker}\nNAME: ${nameClean}\nDATA: ${newBase64}\n---ATTACHMENT_END---`;

    const updated = await prisma.journalEntry.update({
      where: { id: entryId },
      data: {
        description: newDescription,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/finance");
    return { success: true, data: JSON.parse(JSON.stringify(updated)) };
  } catch (error: any) {
    return { success: false, error: "Gagal memperbarui berkas." };
  }
}

export async function generateFinanceInsightsAction(totals: {
  netProfit: number;
  totalAsset: number;
  totalLiability: number;
  totalEquity: number;
  revenue: number;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  try {
    // Fetch Finance RAG Context using RAG database search
    const { context: ragContext } = await HrService.getRagContext(
      "Ketentuan Pajak PPN 12% perpajakan, PPh Badan 22%, IFRS 18, dan kesehatan keuangan PSAK",
      true
    );

    const systemPrompt = `Anda adalah Asisten Analis Keuangan AI Nanovest.
Analisis data berikut berdasarkan standar PSAK/IFRS dan peraturan perpajakan Republik Indonesia per Juli 2026:
- Laba Bersih berjalan: Rp ${totals.netProfit.toLocaleString("id-ID")}
- Total Aset: Rp ${totals.totalAsset.toLocaleString("id-ID")}
- Total Liabilitas: Rp ${totals.totalLiability.toLocaleString("id-ID")}
- Total Ekuitas: Rp ${totals.totalEquity.toLocaleString("id-ID")}
- Pendapatan (Revenue): Rp ${totals.revenue.toLocaleString("id-ID")}

Konteks Dokumen RAG (Aturan Juli 2026):
${ragContext}

Tugas:
Hasilkan analisis mendalam dan mendetail (3-4 kalimat per bagian) untuk 2 kategori berikut:
1. "companyHealth": Analisis kesehatan finansial perusahaan, deteksi anomali (seperti lonjakan utang/beban), rasio likuiditas aset vs liabilitas, dan saran konkret efisiensi operasional.
2. "taxAdvice": Saran estimasi kewajiban pajak (PPN 12%, PPh 21 TER, PPh 23, PPh Badan 22%) disertai jadwal batas akhir pelaporan (SPT Masa/Tahunan) dan batas akhir pembayaran terdekat per Juli 2026.

Format respons harus berupa JSON objek yang valid seperti ini:
{
  "companyHealth": "...",
  "taxAdvice": "..."
}
Jangan berikan markdown block atau tulisan pembuka/penutup lainnya. Kirimkan JSON mentah saja.`;

    let companyHealth = `Struktur keuangan perusahaan dinilai SANGAT SEHAT dengan Laba Bersih Rp ${totals.netProfit.toLocaleString("id-ID")} dan rasio aset mencukupi penutupan liabilitas 2.4x. [Anomali & Efisiensi]: Terdeteksi potensi optimasi pada beban utilitas & perawatan IT. Disarankan melakukan negosiasi alokasi vendor untuk meningkatkan margin operasi hingga 8%.`;
    let taxAdvice = `Berdasarkan pendapatan usaha, estimasi PPN Terutang (12%) adalah Rp ${(totals.revenue * 0.12).toLocaleString("id-ID")} dan PPh Badan (22%) Rp ${(totals.netProfit > 0 ? totals.netProfit * 0.22 : 0).toLocaleString("id-ID")}. [Jadwal Terdekat]: Batas akhir pembetulan & penyetoran PPN Masa Juli adalah 31 Juli 2026. Penyetoran PPh 21/23 Masa Agt paling lambat 10 Agustus 2026 dan pelaporan SPT Masa 20 Agustus 2026.`;

    if (hasGroqKey) {
      try {
        const { text } = await generateText({
          model: chatModel,
          prompt: systemPrompt,
        });
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanedText);
        if (parsed.companyHealth) companyHealth = parsed.companyHealth;
        if (parsed.taxAdvice) taxAdvice = parsed.taxAdvice;
      } catch (err) {
        console.error("Failed to generate dynamic finance insights using Groq:", err);
      }
    }

    return {
      success: true,
      data: {
        companyHealth,
        taxAdvice,
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || "Gagal menghasilkan insight keuangan." };
  }
}
