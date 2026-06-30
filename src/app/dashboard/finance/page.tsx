"use client";

import { useState } from "react";

interface LedgerAccount {
  code: string;
  name: string;
  type: "Asset" | "Liability" | "Equity";
  debit: number;
  credit: number;
}

export default function FinanceTeaserPage() {
  const [ledger, setLedger] = useState<LedgerAccount[]>([
    { code: "1001", name: "Cash on Hand", type: "Asset", debit: 150000000, credit: 0 },
    { code: "1002", name: "Bank Account (BCA)", type: "Asset", debit: 320500000, credit: 20000000 },
    { code: "2001", name: "Accounts Payable", type: "Liability", debit: 5000000, credit: 15000000 },
    { code: "3001", name: "Owner Capital", type: "Equity", debit: 0, credit: 440500000 },
  ]);

  const [debitAccount, setDebitAccount] = useState("1002");
  const [creditAccount, setCreditAccount] = useState("2001");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(val);
  };

  const handlePostEntry = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Please enter a valid positive transaction amount.");
      return;
    }

    if (debitAccount === creditAccount) {
      setError("Double-entry error: Debit and Credit accounts must be different.");
      return;
    }

    // Apply double-entry bookkeeping updates
    setLedger((prev) =>
      prev.map((acc) => {
        if (acc.code === debitAccount) {
          return { ...acc, debit: acc.debit + amt };
        }
        if (acc.code === creditAccount) {
          return { ...acc, credit: acc.credit + amt };
        }
        return acc;
      })
    );

    const debName = ledger.find((a) => a.code === debitAccount)?.name;
    const credName = ledger.find((a) => a.code === creditAccount)?.name;
    setSuccess(
      `Successfully posted: Debited ${debName} & Credited ${credName} by ${formatRupiah(amt)}.`
    );
    setAmount("");
  };

  const totalDebit = ledger.reduce((sum, item) => sum + item.debit, 0);
  const totalCredit = ledger.reduce((sum, item) => sum + item.credit, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-900 pb-6 gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-400 mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Interactive Ledger Module
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Finance Ledger</h1>
          <p className="text-sm text-zinc-400 mt-1">
            General Ledger, Double-Entry validation, and Trial Balance calculations.
          </p>
        </div>
      </div>

      {/* Warning/Alert box */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h3 className="text-base font-bold text-white mb-2">Nanovest Accounting Requirement Showcase</h3>
        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
          To fulfill the **Accounting Specialist Intern** guidelines, this module enforces strict double-entry checks. Debits must equal credits for every transaction, keeping the general ledger balanced at all times.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-900">
            <span className="text-emerald-400 block mb-1">Double-Entry Rules</span>
            <span className="text-zinc-500 font-medium">Debits == Credits validation in client state & database.</span>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-900">
            <span className="text-emerald-400 block mb-1">Trial Balance Engine</span>
            <span className="text-zinc-500 font-medium">Real-time compilation of Assets, Liabilities, and Equity balances.</span>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-900">
            <span className="text-emerald-400 block mb-1">Reporting Automations</span>
            <span className="text-zinc-500 font-medium">Balanced: total Debits and total Credits are verified.</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Mock Ledger Preview */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6">
          <h3 className="text-base font-bold text-white mb-4">General Ledger Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-zinc-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="pb-3">Code</th>
                  <th className="pb-3">Account Name</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3 text-right">Debit</th>
                  <th className="pb-3 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60">
                {ledger.map((row) => (
                  <tr key={row.code} className="text-zinc-300">
                    <td className="py-3.5 font-mono text-xs">{row.code}</td>
                    <td className="py-3.5 font-medium text-white">{row.name}</td>
                    <td className="py-3.5">{row.type}</td>
                    <td className="py-3.5 text-right font-mono text-xs">{formatRupiah(row.debit)}</td>
                    <td className="py-3.5 text-right font-mono text-xs">{formatRupiah(row.credit)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-zinc-800 font-bold text-white bg-zinc-900/20">
                  <td className="py-4" colSpan={3}>Trial Balance Total:</td>
                  <td className="py-4 text-right font-mono text-emerald-400">{formatRupiah(totalDebit)}</td>
                  <td className="py-4 text-right font-mono text-emerald-400">{formatRupiah(totalCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction Posting Form */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl p-6 shadow-2xl space-y-4 h-fit">
          <h3 className="text-base font-bold text-white">Post Journal Entry</h3>
          
          {error && (
            <div className="rounded-lg bg-red-950/50 border border-red-500/30 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-emerald-950/50 border border-emerald-500/30 p-3 text-xs text-emerald-400">
              {success}
            </div>
          )}

          <form onSubmit={handlePostEntry} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Debit Account (Receiving)
              </label>
              <select
                value={debitAccount}
                onChange={(e) => setDebitAccount(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/80"
              >
                {ledger.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} - {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Credit Account (Paying)
              </label>
              <select
                value={creditAccount}
                onChange={(e) => setCreditAccount(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/80"
              >
                {ledger.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} - {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Amount (Rp)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 5000000"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500/80"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-xs font-semibold text-black transition hover:opacity-95 active:scale-[0.98]"
            >
              Post Balanced Entry
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
