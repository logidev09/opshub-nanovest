"use server";

import { getServerSession } from "next-auth/next";
import { revalidatePath } from "next/cache";
import { BalanceSide } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/features/shared/lib/db";
import { AuditService } from "@/features/audit/services/audit.service";

type SessionUser = {
  id: string;
  role?: string;
};

interface PostJournalEntryInput {
  description: string;
  entryDate: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
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
  if (!["ADMIN", "HR"].includes(sessionUser.role || "")) {
    return { success: false, error: "Hanya admin atau HR yang dapat memposting jurnal." };
  }

  const description = input.description.trim();
  const amount = Number(input.amount);

  if (!description) {
    return { success: false, error: "Deskripsi jurnal wajib diisi." };
  }

  if (!input.entryDate) {
    return { success: false, error: "Tanggal jurnal wajib diisi." };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: "Nominal jurnal harus lebih besar dari nol." };
  }

  if (input.debitAccountId === input.creditAccountId) {
    return { success: false, error: "Akun debit dan kredit harus berbeda." };
  }

  try {
    const [debitAccount, creditAccount, entryCount] = await Promise.all([
      prisma.financeAccount.findUnique({
        where: { id: input.debitAccountId },
        select: { id: true, code: true, name: true, isActive: true },
      }),
      prisma.financeAccount.findUnique({
        where: { id: input.creditAccountId },
        select: { id: true, code: true, name: true, isActive: true },
      }),
      prisma.journalEntry.count(),
    ]);

    if (!debitAccount || !creditAccount) {
      return { success: false, error: "Akun ledger tidak ditemukan." };
    }

    if (!debitAccount.isActive || !creditAccount.isActive) {
      return { success: false, error: "Akun ledger nonaktif tidak dapat dipakai untuk posting." };
    }

    const createdEntry = await prisma.journalEntry.create({
      data: {
        reference: `JE-${new Date().getFullYear()}-${String(entryCount + 1).padStart(4, "0")}`,
        description,
        entryDate: new Date(input.entryDate),
        totalDebit: amount,
        totalCredit: amount,
        postedById: sessionUser.id,
        lines: {
          create: [
            {
              financeAccountId: debitAccount.id,
              side: BalanceSide.DEBIT,
              amount,
            },
            {
              financeAccountId: creditAccount.id,
              side: BalanceSide.CREDIT,
              amount,
            },
          ],
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
        amount,
        debitAccount: debitAccount.code,
        creditAccount: creditAccount.code,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/finance");
    return { success: true, message: "Jurnal balanced berhasil diposting." };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Gagal memposting jurnal.") };
  }
}

export async function deleteJournalEntryAction(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "ADMIN") {
    return { success: false, error: "Hanya admin yang dapat menghapus/mengubah kembali jurnal." };
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
