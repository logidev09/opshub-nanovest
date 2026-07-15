"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  postJournalEntryAction,
  deleteJournalEntryAction,
  updateJournalEntryAction,
  updateJournalEntryAttachmentAction,
  generateFinanceInsightsAction,
} from "@/features/finance/actions/ledger.actions";
import { exportToCSV } from "@/features/shared/lib/export";
import { FileViewerModal } from "@/features/shared/components/file-viewer-modal";

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
  userRole: string;
  userDivision?: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
}

function parseAttachmentFromDescription(fullDesc: string) {
  const marker = "---ATTACHMENT_START---";
  if (!fullDesc.includes(marker)) {
    return { text: fullDesc, attachment: null };
  }
  const parts = fullDesc.split(marker);
  const text = parts[0].trim();
  const rest = parts[1] || "";
  const nameMatch = rest.match(/NAME:\s*(.*?)\n/);
  const dataClean = rest.split("DATA:")[1]?.split("---ATTACHMENT_END---")[0]?.trim() || "";
  const nameClean = nameMatch ? nameMatch[1].trim() : "Attachment";
  return {
    text,
    attachment: {
      name: nameClean,
      data: dataClean
    }
  };
}

export function FinanceLedgerClient({
  accounts,
  entries,
  totalDebit,
  totalCredit,
  categoryTotals,
  userRole,
  userDivision = "",
}: FinanceLedgerClientProps) {
  const router = useRouter();
  
  // Calculate totals for visualization
  const asset = categoryTotals.ASSET || 0;
  const liability = categoryTotals.LIABILITY || 0;
  const equity = categoryTotals.EQUITY || 0;
  const revenue = categoryTotals.REVENUE || 0;
  const expense = categoryTotals.EXPENSE || 0;
  const totalBS = asset + liability + equity;

  // New Journal Entry Form States
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [note, setNote] = useState(""); // Catatan Opsional (Task 4)
  const [debitAccountId, setDebitAccountId] = useState(accounts[0]?.id ?? "");
  const [creditAccountId, setCreditAccountId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Active File Viewer Modal state
  const [activeViewerFile, setActiveViewerFile] = useState<{
    name: string;
    data: string;
    entryId?: string;
    editedAt?: string | null;
  } | null>(null);
  
  // File upload for new entry
  const [fileName, setFileName] = useState("");
  const [fileBase64, setFileBase64] = useState("");
  const [readingFile, setReadingFile] = useState(false);

  // Edit Journal Entry States (Admin only)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editEntryDate, setEditEntryDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFileName, setEditFileName] = useState("");
  const [editFileBase64, setEditFileBase64] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Floating Chat states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    {
      role: "assistant",
      text: "Halo! Saya Finance AI Nanovest. Saya memiliki akses real-time ke data buku besar ini serta basis regulasi PSAK/IFRS dan perpajakan Juli 2026. Ada yang ingin Anda tanyakan seputar kepatuhan pajak, trial balance, atau entri jurnal?",
    },
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  // Dynamic Insights states
  const [aiInsights, setAiInsights] = useState<{ companyHealth: string; taxAdvice: string } | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadInsights() {
      setLoadingInsights(true);
      const res = await generateFinanceInsightsAction({
        netProfit: revenue - expense,
        totalAsset: asset,
        totalLiability: liability,
        totalEquity: equity,
        revenue,
      });
      if (res.success && res.data) {
        setAiInsights(res.data);
      }
      setLoadingInsights(false);
    }
    loadInsights();
  }, [revenue, expense, asset, liability, equity]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      if (isEdit) {
        setEditFileName(file.name);
        setEditFileBase64(base64);
      } else {
        setFileName(file.name);
        setFileBase64(base64);
      }
      setReadingFile(false);
    };
    reader.onerror = () => {
      alert("Gagal membaca berkas.");
      setReadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleExportLedger = () => {
    const headers = [
      { key: "code", label: "Kode Akun" },
      { key: "name", label: "Nama Akun" },
      { key: "categoryLabel", label: "Kategori" },
      { key: "debit", label: "Debit" },
      { key: "credit", label: "Kredit" },
      { key: "balance", label: "Saldo" },
    ];
    exportToCSV(ledgerAccounts, headers, "Laporan_Trial_Balance_Nanovest");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const finalDesc = description.trim() + (note.trim() ? ` | Catatan: ${note.trim()}` : "");

    const result = await postJournalEntryAction({
      description: finalDesc,
      entryDate,
      debitAccountId,
      creditAccountId,
      amount: Number(amount),
      attachmentName: fileName || undefined,
      attachmentData: fileBase64 || undefined,
    });

    setIsSubmitting(false);
    if (result.success) {
      setMessage({ type: "success", text: result.message || "Jurnal berhasil diposting." });
      setDescription("");
      setNote("");
      setAmount("");
      setFileName("");
      setFileBase64("");
      router.refresh();
    } else {
      setMessage({ type: "error", text: result.error || "Gagal memposting jurnal." });
    }
  };

  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus jurnal ini?")) return;
    setIsDeleting(id);
    const result = await deleteJournalEntryAction(id);
    setIsDeleting(null);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || "Gagal menghapus jurnal");
    }
  };

  // Trigger Edit Mode (Admin only)
  const openEditModal = (entry: JournalEntryView) => {
    const parsed = parseAttachmentFromDescription(entry.description);
    setEditingEntryId(entry.id);
    setEditEntryDate(entry.entryDate.slice(0, 10));
    setEditDescription(parsed.text);
    setEditFileName(parsed.attachment?.name || "");
    setEditFileBase64(parsed.attachment?.data || "");
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntryId) return;

    setEditLoading(true);
    const result = await updateJournalEntryAction(editingEntryId, {
      entryDate: editEntryDate,
      description: editDescription,
      attachmentName: editFileName || undefined,
      attachmentData: editFileBase64 || undefined,
    });
    setEditLoading(false);

    if (result.success) {
      setIsEditModalOpen(false);
      router.refresh();
    } else {
      alert(result.error || "Gagal memperbarui jurnal entry.");
    }
  };

  const handleDownloadAttachment = (name: string, data: string) => {
    const link = document.createElement("a");
    link.href = `data:application/octet-stream;base64,${data}`;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Financial Insights Calculations
  const netProfit = revenue - expense;
  const isHealthy = netProfit > 0 && asset > liability * 1.5;
  const estimatedPPN = revenue * 0.11;
  const estimatedPPh = netProfit > 0 ? netProfit * 0.22 : 0;

  // Floating Chat submission
  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: userText }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...chatMessages.map((m) => ({
              role: m.role,
              content: m.text,
            })),
            { role: "user", content: userText },
          ],
        }),
      });

      if (res.ok) {
        const text = await res.text();
        // Since Vercel stream writes text-deltas, we parse or display it.
        // For simplicity and robustness, if it's the stream format, we strip stream markers or display text directly.
        let cleanedResponse = text;
        
        // Basic parser for Vercel AI SDK text-deltas if present
        if (text.includes('{"type":"text-delta"')) {
          try {
            const matches = text.match(/"delta":"(.*?)"/g);
            if (matches) {
              cleanedResponse = matches
                .map((m) => m.replace(/"delta":"/, "").replace(/"$/, ""))
                .join("")
                .replace(/\\n/g, "\n");
            }
          } catch {
            // fallback
          }
        } else if (text.startsWith("0:")) {
          // AI SDK v3 protocol
          cleanedResponse = text
            .split("\n")
            .filter((line) => line.startsWith("0:"))
            .map((line) => line.slice(2).replace(/"/g, ""))
            .join("");
        }

        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", text: cleanedResponse.replace(/\\n/g, "\n").trim() },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Maaf, terjadi kesalahan saat menghubungi asisten AI." },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Terjadi kesalahan koneksi internet." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-8 relative">
      {/* RAG Documents Manager Navigation */}
      {(userRole === "ADMIN" || userDivision === "Accounting") && (
        <div className="flex justify-start mb-2">
          <Link
            href="/dashboard/finance/policies"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-bold text-black transition active:scale-95 shadow-md shadow-emerald-500/10"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Kelola Dokumen RAG (PSAK/Pajak)
          </Link>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h3 className="mb-2 text-base font-bold text-white">Nanovest Accounting Requirement Showcase</h3>
        <p className="mb-4 text-sm leading-relaxed text-zinc-400">
          Modul ini sudah membaca chart of accounts dari database, menghitung total trial balance secara real-time, dan memvalidasi jurnal balanced sebelum disimpan.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 text-xs font-semibold">
          {[
            { title: "Total Assets (Aset)", value: asset },
            { title: "Total Liabilities (Liabilitas)", value: liability },
            { title: "Total Equity (Ekuitas)", value: equity },
            { title: "Total Revenue (Pendapatan)", value: revenue },
            { title: "Total Expenses (Beban)", value: expense },
          ].map((item) => (
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
          {/* Balance Sheet Donut Chart */}
          <div className="md:col-span-5 flex flex-col items-center justify-center p-4 border border-zinc-900 rounded-xl bg-zinc-950/20">
            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">Balance Sheet Structure</h4>
            <div className="relative h-44 w-44">
              <svg className="h-full w-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="35" fill="transparent" stroke="#18181b" strokeWidth="10" />
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

          {/* Operating Profitability Bars */}
          <div className="md:col-span-7 space-y-6 p-6 border border-zinc-900 rounded-xl bg-zinc-950/20">
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Operating Performance</h4>
              <p className="text-[10px] text-zinc-500 mb-4">Perbandingan pendapatan usaha terhadap biaya pengeluaran ledger.</p>
            </div>

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
                />
                <div
                  style={{ width: `${revenue + expense > 0 ? (expense / (revenue + expense)) * 100 : 0}%` }}
                  className="bg-rose-500 transition-all duration-1000"
                />
              </div>
            </div>

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
        <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 lg:col-span-2 space-y-6">
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-white">General Ledger Summary</h3>
                <button
                  type="button"
                  onClick={handleExportLedger}
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-800 hover:border-emerald-500/50 bg-zinc-950 text-[10px] font-bold text-zinc-300 hover:text-white transition"
                >
                  📥 Export Ledger (CSV)
                </button>
              </div>
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

          {/* AI Tax & Financial Health Insights (July 2026) */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">AI Tax & Financial Health Insights (July 2026)</h4>
              </div>
              {loadingInsights && (
                <span className="text-[10px] text-zinc-500 animate-pulse">Menganalisis RAG perpajakan...</span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed text-zinc-400">
              <div className="space-y-2 p-3.5 border border-zinc-900 bg-zinc-900/20 rounded-xl relative overflow-hidden">
                <span className="font-semibold text-emerald-400 block">Kesehatan Finansial Perusahaan</span>
                {loadingInsights ? (
                  <div className="space-y-2 py-1 animate-pulse">
                    <div className="h-3 bg-zinc-850 rounded w-3/4"></div>
                    <div className="h-3 bg-zinc-850 rounded w-5/6"></div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">
                    {aiInsights ? aiInsights.companyHealth : `Status Laba Bersih: ${formatCurrency(netProfit)}. Struktur keuangan perusahaan dinilai ${isHealthy ? "SANGAT SEHAT" : "PERLU EVALUASI"} berdasarkan rasio perbandingan aset terhadap liabilitas dan ekuitas.`}
                  </p>
                )}
              </div>
              <div className="space-y-2 p-3.5 border border-zinc-900 bg-zinc-900/20 rounded-xl relative overflow-hidden">
                <span className="font-semibold text-emerald-400 block">Saran Estimasi Kewajiban Pajak</span>
                {loadingInsights ? (
                  <div className="space-y-2 py-1 animate-pulse">
                    <div className="h-3 bg-zinc-850 rounded w-2/3"></div>
                    <div className="h-3 bg-zinc-850 rounded w-full"></div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">
                    {aiInsights ? aiInsights.taxAdvice : `Berdasarkan pendapatan berjalan, estimasi PPN Terutang (12%) adalah sebesar ${formatCurrency(revenue * 0.12)}. Estimasi PPh Badan (22%) dari profit adalah ${formatCurrency(netProfit > 0 ? netProfit * 0.22 : 0)}. Pastikan pencatatan pajak tangguhan sudah sesuai PSAK terbaru.`}
                  </p>
                )}
              </div>
            </div>
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
                    onClick={openDatePicker}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500/80 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:hidden cursor-pointer"
                  />
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

              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Catatan Opsional (Catatan / Memo)
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Catatan tambahan (mis. Memo khusus)"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500/80"
                />
              </div>

              {/* Optional Attachment Upload Field (Task 4) */}
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Lampiran Berkas Bukti (PDF, PNG, JPEG, JPG, DOCX, TXT - Opsional)
                </label>
                <div className="relative flex items-center justify-between border border-zinc-800 rounded-xl bg-zinc-950 px-3 py-2 text-xs">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpeg,.jpg,.docx,.txt"
                    onChange={(e) => handleFileChange(e)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                    disabled={readingFile}
                  />
                  <span className="text-zinc-400 truncate max-w-[170px]">
                    {fileName || "Pilih berkas..."}
                  </span>
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded bg-zinc-850 text-[10px] font-bold text-zinc-300"
                  >
                    Pilih File
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || readingFile}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-xs font-semibold text-black transition hover:opacity-95 disabled:opacity-50"
              >
                {isSubmitting ? "Menyimpan..." : "Post Balanced Entry"}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6">
            <h3 className="mb-4 text-base font-bold text-white">Recent Journal Entries</h3>
            <div className="space-y-3">
              {entries.length === 0 ? (
                <div className="text-zinc-500 text-xs text-center py-4">Belum ada jurnal masuk.</div>
              ) : (
                entries.map((entry) => {
                  const parsed = parseAttachmentFromDescription(entry.description);
                  return (
                    <div key={entry.id} className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">{entry.reference}</p>
                          <p className="text-xs text-zinc-500">{parsed.text}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[11px] text-zinc-500">
                            {new Date(entry.entryDate).toLocaleDateString("id-ID")}
                          </span>
                          <div className="flex gap-2 items-center mt-1">
                            {userRole === "ADMIN" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(entry)}
                                  className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase transition"
                                >
                                  Sunting
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(entry.id)}
                                  disabled={isDeleting === entry.id}
                                  className="text-[10px] text-rose-500 hover:text-rose-400 font-bold uppercase transition disabled:opacity-50"
                                >
                                  Hapus
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Display attachment if it exists */}
                      {parsed.attachment && (
                        <div className="mt-2.5 p-2 border border-zinc-900 bg-zinc-950 rounded-xl flex items-center justify-between text-xs">
                          <span className="text-zinc-400 truncate max-w-[150px] font-mono text-[10px]">
                            📁 {parsed.attachment.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveViewerFile({
                                name: parsed.attachment!.name,
                                data: parsed.attachment!.data,
                                entryId: entry.id,
                              });
                            }}
                            className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 uppercase transition"
                          >
                            Lihat Berkas
                          </button>
                        </div>
                      )}

                      <div className="space-y-1 text-xs text-zinc-400 mt-3 pt-2 border-t border-zinc-900/40">
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
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Chat Widget (Task 2 & 6) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {isChatOpen && (
          <div className="mb-4 w-80 md:w-96 h-[480px] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl">
            {/* Header */}
            <div className="px-4 py-3 bg-zinc-900/60 border-b border-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">Finance AI Assistant</span>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-zinc-400 hover:text-white transition text-xs"
              >
                ✕
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col max-w-[85%] ${
                    msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                  }`}
                >
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">
                    {msg.role === "user" ? "Anda" : "Finance AI"}
                  </span>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                        : "bg-zinc-900/80 text-zinc-300 border border-zinc-900"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="flex gap-2 items-center text-zinc-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[10px]">AI sedang menganalisis ledger...</span>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleChatSend} className="p-3 border-t border-zinc-900 bg-zinc-950/40 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Tanyakan analisis keuangan/pajak..."
                className="flex-1 rounded-xl border border-zinc-850 bg-zinc-900 px-3.5 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500/80"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="px-3 rounded-xl bg-emerald-500 text-black hover:opacity-95 disabled:opacity-50 font-bold"
              >
                Kirim
              </button>
            </form>
          </div>
        )}

        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="h-16 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-black font-bold text-2xl shadow-xl hover:scale-105 active:scale-95 transition"
          title="Tanya Finance AI"
        >
          💬
        </button>
      </div>

      {/* Admin Edit Journal Entry Modal (Task 3) */}
      {isEditModalOpen && editingEntryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl max-w-md w-full space-y-4 text-xs text-left">
            <div className="flex justify-between items-start">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-zinc-400">Sunting Jurnal Entry (Admin)</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Tanggal Jurnal
                </label>
                <input
                  type="date"
                  required
                  value={editEntryDate}
                  onChange={(e) => setEditEntryDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-white outline-none focus:border-emerald-500/80 [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Deskripsi
                </label>
                <input
                  type="text"
                  required
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-white outline-none focus:border-emerald-500/80"
                />
              </div>

              {/* Optional Edit File Attachment */}
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Ubah Lampiran Berkas (PDF, PNG, JPEG, JPG, DOCX - Opsional)
                </label>
                <div className="relative flex items-center justify-between border border-zinc-800 rounded-xl bg-zinc-950 px-3.5 py-2">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpeg,.jpg,.docx"
                    onChange={(e) => handleFileChange(e, true)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                    disabled={readingFile}
                  />
                  <span className="text-zinc-400 truncate max-w-[200px]">
                    {editFileName || "Pilih berkas baru..."}
                  </span>
                  <button
                    type="button"
                    className="px-2.5 py-1 rounded bg-zinc-850 text-[10px] font-bold text-zinc-300 animate-pulse"
                  >
                    Pilih File
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editLoading || readingFile}
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-black font-semibold hover:opacity-95 disabled:opacity-50"
                >
                  {editLoading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Viewer Modal (Task 6) */}
      {activeViewerFile && (
        <FileViewerModal
          fileName={activeViewerFile.name}
          fileData={activeViewerFile.data}
          editedAt={activeViewerFile.editedAt}
          onClose={() => setActiveViewerFile(null)}
          onSaveText={async (newText) => {
            const res = await updateJournalEntryAttachmentAction(activeViewerFile.entryId!, newText);
            if (res.success && res.data) {
              setActiveViewerFile(prev => prev ? {
                ...prev,
                data: Buffer.from(newText, "utf-8").toString("base64"),
                editedAt: (res.data as any).metadata?.editedAt || null
              } : null);
              router.refresh();
            }
            return res;
          }}
        />
      )}
    </div>
  );
}
