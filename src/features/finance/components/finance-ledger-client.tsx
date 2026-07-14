"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { postJournalEntryAction } from "@/features/finance/actions/ledger.actions";

interface LedgerAccountView {
  id: string;
  code: string;
  name: string;
  categoryLabel: string;
  debit: number;
  credit: number;
  balance: number;
}

interface JournalEntryView {
  id: string;
  reference: string;
  description: string;
  entryDate: string;
  totalDebit: number;
  totalCredit: number;
  lines: Array<{
    id: string;
    side: string;
    amount: number;
    accountCode: string;
    accountName: string;
  }>;
}

interface FinanceLedgerClientProps {
  accounts: LedgerAccountView[];
  entries: JournalEntryView[];
  totalDebit: number;
  totalCredit: number;
  categoryTotals: Record<string, number>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
}

export function FinanceLedgerClient({
  accounts,
  entries,
  totalDebit,
  totalCredit,
  categoryTotals,
}: FinanceLedgerClientProps) {
  const router = useRouter();
  
  // Calculate totals for visualization
  const asset = categoryTotals.ASSET || 0;
  const liability = categoryTotals.LIABILITY || 0;
  const equity = categoryTotals.EQUITY || 0;
  const revenue = categoryTotals.REVENUE || 0;
  const expense = categoryTotals.EXPENSE || 0;
  const totalBS = asset + liability + equity;

  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [debitAccountId, setDebitAccountId] = useState(accounts[0]?.id ?? "");
  const [creditAccountId, setCreditAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const ledgerAccounts = useMemo(
    () =>
      accounts.filter((account) =>
        ["Asset", "Liability", "Equity", "Revenue", "Expense"].includes(account.categoryLabel)
      ),
    [accounts]
  );

  const openDatePicker = () => {
    if (!dateInputRef.current) return;
    const pickerInput = dateInputRef.current as HTMLInputElement & { showPicker?: () => void };
    if (pickerInput.showPicker) {
      pickerInput.showPicker();
      return;
    }
    pickerInput.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const result = await postJournalEntryAction({
      description,
      entryDate,
      debitAccountId,
      creditAccountId,
      amount: Number(amount),
    });

    setIsSubmitting(false);
    if (!result.success) {
      setMessage({ type: "error", text: result.error || "Gagal memposting jurnal." });
      return;
    }

    setMessage({ type: "success", text: result.message || "Jurnal berhasil diposting." });
    setDescription("");
    setAmount("");
    router.refresh();
  };

  const summaryCards = [
    { title: "Asset", value: categoryTotals.ASSET || 0 },
    { title: "Liability", value: categoryTotals.LIABILITY || 0 },
    { title: "Equity", value: categoryTotals.EQUITY || 0 },
    { title: "Revenue", value: categoryTotals.REVENUE || 0 },
    { title: "Expense", value: categoryTotals.EXPENSE || 0 },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h3 className="mb-2 text-base font-bold text-white">Nanovest Accounting Requirement Showcase</h3>
        <p className="mb-4 text-sm leading-relaxed text-zinc-400">
          Modul ini sudah membaca chart of accounts dari database, menghitung total trial balance secara real-time, dan memvalidasi jurnal balanced sebelum disimpan.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 text-xs font-semibold">
          {summaryCards.map((item) => (
            <div key={item.title} className="rounded-xl border border-zinc-900 bg-zinc-950 p-3.5">
              <span className="mb-1 block text-emerald-400">{item.title}</span>
              <span className="font-medium text-zinc-300">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Visual Chart Card */}
      <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 md:p-8 backdrop-blur-xl">
        <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-wider text-zinc-400">Financial Breakdown Visualization</h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Balance Sheet Donut Chart (Col 5) */}
          <div className="md:col-span-5 flex flex-col items-center justify-center p-4 border border-zinc-900 rounded-xl bg-zinc-950/20">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Balance Sheet Structure</h4>
            <div className="relative h-44 w-44">
              <svg className="h-full w-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="35" fill="transparent" stroke="#18181b" strokeWidth="10" />
                {/* Asset (Green) */}
                {asset > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="35"
                    fill="transparent"
                    stroke="#10b981"
                    strokeWidth="10"
                    strokeDasharray={`${(asset / (totalBS || 1)) * 219.9} ${219.9}`}
                    strokeDashoffset="0"
                    transform="rotate(-90 50 50)"
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                )}
                {/* Liability (Yellow) */}
                {liability > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="35"
                    fill="transparent"
                    stroke="#f59e0b"
                    strokeWidth="10"
                    strokeDasharray={`${(liability / (totalBS || 1)) * 219.9} ${219.9}`}
                    strokeDashoffset={`${-((asset / (totalBS || 1)) * 219.9)}`}
                    transform="rotate(-90 50 50)"
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                )}
                {/* Equity (Blue) */}
                {equity > 0 && (
                  <circle
                    cx="50"
                    cy="50"
                    r="35"
                    fill="transparent"
                    stroke="#3b82f6"
                    strokeWidth="10"
                    strokeDasharray={`${(equity / (totalBS || 1)) * 219.9} ${219.9}`}
                    strokeDashoffset={`${-(((asset + liability) / (totalBS || 1)) * 219.9)}`}
                    transform="rotate(-90 50 50)"
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total BS</span>
                <span className="text-sm font-extrabold text-white mt-0.5">
                  {new Intl.NumberFormat("id-ID", { notation: "compact" }).format(totalBS)}
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex gap-4 text-[10px] font-semibold">
              <span className="flex items-center gap-1.5 text-[#10b981]">
                <span className="h-2.5 w-2.5 rounded bg-emerald-500" />
                Asset ({totalBS > 0 ? Math.round((asset / totalBS) * 100) : 0}%)
              </span>
              <span className="flex items-center gap-1.5 text-[#f59e0b]">
                <span className="h-2.5 w-2.5 rounded bg-amber-500" />
                Liability ({totalBS > 0 ? Math.round((liability / totalBS) * 100) : 0}%)
              </span>
              <span className="flex items-center gap-1.5 text-[#3b82f6]">
                <span className="h-2.5 w-2.5 rounded bg-blue-500" />
                Equity ({totalBS > 0 ? Math.round((equity / totalBS) * 100) : 0}%)
              </span>
            </div>
          </div>

          {/* Operating Profitability Bars (Col 7) */}
          <div className="md:col-span-7 space-y-6 p-6 border border-zinc-900 rounded-xl bg-zinc-950/20">
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Operating Performance</h4>
              <p className="text-[10px] text-zinc-500 mb-4">Perbandingan pendapatan usaha terhadap biaya pengeluaran ledger.</p>
            </div>

            {/* Profit Margin Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-zinc-300">
                <span>Revenue vs Expense Ratio</span>
                <span className="text-emerald-400">
                  {revenue + expense > 0 ? Math.round((revenue / (revenue + expense)) * 100) : 0}% / {revenue + expense > 0 ? Math.round((expense / (revenue + expense)) * 100) : 0}%
                </span>
              </div>
              <div className="h-3.5 w-full rounded-full bg-zinc-900 overflow-hidden flex">
                <div
                  style={{ width: `${revenue + expense > 0 ? (revenue / (revenue + expense)) * 100 : 0}%` }}
                  className="bg-emerald-500 transition-all duration-1000"
                  title="Revenue"
                />
                <div
                  style={{ width: `${revenue + expense > 0 ? (expense / (revenue + expense)) * 100 : 0}%` }}
                  className="bg-rose-500 transition-all duration-1000"
                  title="Expense"
                />
              </div>
            </div>

            {/* Financial indicators */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-900/60">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Gross Revenue</span>
                <p className="text-base font-extrabold text-white mt-0.5">{formatCurrency(revenue)}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Total Expense</span>
                <p className="text-base font-extrabold text-rose-400 mt-0.5">{formatCurrency(expense)}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-900/40 flex justify-between items-center text-xs">
              <span className="text-zinc-500 font-medium">Net Profit/Loss Estimate:</span>
              <span className={`font-bold ${revenue >= expense ? "text-emerald-400" : "text-rose-400"}`}>
                {revenue >= expense ? "+" : ""}
                {formatCurrency(revenue - expense)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h3 className="text-base font-bold text-white">General Ledger Summary</h3>
            <span
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                totalDebit === totalCredit
                  ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border border-red-500/20 bg-red-500/10 text-red-400"
              }`}
            >
              {totalDebit === totalCredit ? "Balanced" : "Unbalanced"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-900 text-xs uppercase tracking-wider text-zinc-500">
                  <th className="pb-3">Code</th>
                  <th className="pb-3">Account Name</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3 text-right">Debit</th>
                  <th className="pb-3 text-right">Credit</th>
                  <th className="pb-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60">
                {ledgerAccounts.map((row) => (
                  <tr key={row.id} className="text-zinc-300">
                    <td className="py-3 font-mono text-xs">{row.code}</td>
                    <td className="py-3 font-medium text-white">{row.name}</td>
                    <td className="py-3">{row.categoryLabel}</td>
                    <td className="py-3 text-right font-mono text-xs">{formatCurrency(row.debit)}</td>
                    <td className="py-3 text-right font-mono text-xs">{formatCurrency(row.credit)}</td>
                    <td className="py-3 text-right font-mono text-xs text-emerald-300">{formatCurrency(row.balance)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-zinc-800 bg-zinc-900/20 font-bold text-white">
                  <td className="py-4" colSpan={3}>
                    Trial Balance Total
                  </td>
                  <td className="py-4 text-right font-mono text-emerald-400">{formatCurrency(totalDebit)}</td>
                  <td className="py-4 text-right font-mono text-emerald-400">{formatCurrency(totalCredit)}</td>
                  <td className="py-4 text-right font-mono text-zinc-400">0</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-2xl">
            <h3 className="mb-4 text-base font-bold text-white">Post Journal Entry</h3>

            {message && (
              <div
                className={`mb-4 rounded-lg border p-3 text-xs ${
                  message.type === "success"
                    ? "border-emerald-500/20 bg-emerald-950/50 text-emerald-400"
                    : "border-red-500/20 bg-red-950/50 text-red-400"
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Tanggal Jurnal
                </label>
                <div className="relative">
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500/80"
                  />
                  <button
                    type="button"
                    onClick={openDatePicker}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-zinc-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
                  >
                    Kalender
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Deskripsi
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Contoh: Pembayaran vendor software"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500/80"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Akun Debit
                </label>
                <select
                  value={debitAccountId}
                  onChange={(e) => setDebitAccountId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/80"
                >
                  {ledgerAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name} ({account.categoryLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Akun Kredit
                </label>
                <select
                  value={creditAccountId}
                  onChange={(e) => setCreditAccountId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/80"
                >
                  {ledgerAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name} ({account.categoryLabel})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Nominal
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="5000000"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500/80"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-xs font-semibold text-black transition hover:opacity-95 disabled:opacity-50"
              >
                {isSubmitting ? "Menyimpan..." : "Post Balanced Entry"}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6">
            <h3 className="mb-4 text-base font-bold text-white">Recent Journal Entries</h3>
            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{entry.reference}</p>
                      <p className="text-xs text-zinc-500">{entry.description}</p>
                    </div>
                    <span className="text-[11px] text-zinc-500">
                      {new Date(entry.entryDate).toLocaleDateString("id-ID")}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs text-zinc-400">
                    {entry.lines.map((line) => (
                      <div key={line.id} className="flex items-center justify-between gap-3">
                        <span>
                          {line.side} - {line.accountCode} {line.accountName}
                        </span>
                        <span className="font-mono text-zinc-300">{formatCurrency(line.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
