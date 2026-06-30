import { prisma } from "@/features/shared/lib/db";
import { AccountCategory, BalanceSide } from "@prisma/client";

export function formatAccountCategory(category: AccountCategory) {
  switch (category) {
    case "ASSET":
      return "Asset";
    case "LIABILITY":
      return "Liability";
    case "EQUITY":
      return "Equity";
    case "REVENUE":
      return "Revenue";
    case "EXPENSE":
      return "Expense";
    default:
      return category;
  }
}

export async function getLedgerSnapshot() {
  const [accounts, entries] = await Promise.all([
    prisma.financeAccount.findMany({
      orderBy: { code: "asc" },
      include: {
        journalLines: {
          select: {
            side: true,
            amount: true,
          },
        },
      },
    }),
    prisma.journalEntry.findMany({
      take: 8,
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      include: {
        lines: {
          include: {
            financeAccount: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const summarizedAccounts = accounts.map((account) => {
    const debit = account.journalLines
      .filter((line) => line.side === BalanceSide.DEBIT)
      .reduce((sum, line) => sum + Number(line.amount), 0);
    const credit = account.journalLines
      .filter((line) => line.side === BalanceSide.CREDIT)
      .reduce((sum, line) => sum + Number(line.amount), 0);

    return {
      id: account.id,
      code: account.code,
      name: account.name,
      category: account.category,
      categoryLabel: formatAccountCategory(account.category),
      normalBalance: account.normalBalance,
      debit,
      credit,
      balance: account.normalBalance === BalanceSide.DEBIT ? debit - credit : credit - debit,
    };
  });

  const totalDebit = summarizedAccounts.reduce((sum, account) => sum + account.debit, 0);
  const totalCredit = summarizedAccounts.reduce((sum, account) => sum + account.credit, 0);

  const categoryTotals = summarizedAccounts.reduce<Record<AccountCategory, number>>(
    (acc, account) => {
      acc[account.category] += account.balance;
      return acc;
    },
    {
      ASSET: 0,
      LIABILITY: 0,
      EQUITY: 0,
      REVENUE: 0,
      EXPENSE: 0,
    }
  );

  return {
    accounts: summarizedAccounts,
    entries: entries.map((entry) => ({
      id: entry.id,
      reference: entry.reference,
      description: entry.description,
      entryDate: entry.entryDate.toISOString(),
      totalDebit: Number(entry.totalDebit),
      totalCredit: Number(entry.totalCredit),
      lines: entry.lines.map((line) => ({
        id: line.id,
        side: line.side,
        amount: Number(line.amount),
        accountCode: line.financeAccount.code,
        accountName: line.financeAccount.name,
      })),
    })),
    totalDebit,
    totalCredit,
    categoryTotals,
  };
}
