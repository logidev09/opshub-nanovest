import { getLedgerSnapshot } from "@/features/finance/lib/ledger";
import { FinanceLedgerClient } from "@/features/finance/components/finance-ledger-client";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FinanceLedgerPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  const sessionUser = session.user as any;
  if (sessionUser.role !== "ADMIN" && sessionUser.division !== "Accounting") {
    redirect("/dashboard");
  }

  const snapshot = await getLedgerSnapshot();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-zinc-900 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Database-backed Ledger
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Finance Ledger</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Chart of accounts lengkap, posting jurnal, dan trial balance yang langsung membaca data database.
          </p>
        </div>
      </div>

      <FinanceLedgerClient {...snapshot} userRole={sessionUser.role || "USER"} />
    </div>
  );
}
