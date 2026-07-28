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
  requestJournalEditPermissionAction,
  approveJournalEditPermissionAction,
  getJournalEditPermissionStatusAction,
  undoJournalEntryRevisionAction,
  JournalLineInput,
} from "@/features/finance/actions/ledger.actions";
import { exportToCSV } from "@/features/shared/lib/export";
import { FileViewerModal } from "@/features/shared/components/file-viewer-modal";
import { MultiFileUploader } from "@/features/shared/components/multi-file-uploader";
import { parseAttachments, formatAttachmentsMessage, AttachmentItem } from "@/features/shared/lib/attachment-helper";
import {
  parseJournalRevisions,
  formatDescriptionWithRevisions,
  JournalRevisionItem,
} from "@/features/shared/lib/journal-revision-helper";

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

  // Tax Breakdown Table States (Item 3.1)
  const [taxFilingDeadline, setTaxFilingDeadline] = useState("2026-07-31");
  const [taxPaymentDeadline, setTaxPaymentDeadline] = useState("2026-07-15");
  const [isEditingTaxDates, setIsEditingTaxDates] = useState(false);

  // Payment dates per tax item
  const [taxPaymentDates, setTaxPaymentDates] = useState<Record<string, string>>({
    ppn: "2026-07-12",
    pph21: "2026-07-15",
    pph23: "2026-07-10",
    pph42: "2026-07-14",
    pphbadan: "Belum Disetor",
  });

  // Multi-file attachments per tax item
  const [taxAttachmentsMap, setTaxAttachmentsMap] = useState<Record<string, AttachmentItem[]>>({});

  // Permission state for Accountant journal editing
  const [editPermStatus, setEditPermStatus] = useState<"NONE" | "PENDING" | "APPROVED" | "REJECTED">("NONE");
  const [permRequestedAt, setPermRequestedAt] = useState<string | null>(null);
  const [permProcessedAt, setPermProcessedAt] = useState<string | null>(null);
  const [isRequestingPerm, setIsRequestingPerm] = useState(false);

  // New Journal Entry Form States
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [journalFormLines, setJournalFormLines] = useState<JournalLineInput[]>([
    { side: "DEBIT", financeAccountId: accounts[0]?.id ?? "", amount: 0 },
    { side: "CREDIT", financeAccountId: accounts[1]?.id ?? accounts[0]?.id ?? "", amount: 0 },
  ]);
  const [attachedFiles, setAttachedFiles] = useState<AttachmentItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Active File Viewer Modal state
  const [activeViewerFile, setActiveViewerFile] = useState<{
    name: string;
    data: string;
    entryId?: string;
    editedAt?: string | null;
  } | null>(null);

  // Revision History Modal State
  const [viewingRevisionsEntry, setViewingRevisionsEntry] = useState<{
    id?: string;
    reference: string;
    revisions: JournalRevisionItem[];
  } | null>(null);

  // Edit Journal Entry States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntryView | null>(null);
  const [editEntryDate, setEditEntryDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFormLines, setEditFormLines] = useState<JournalLineInput[]>([]);
  const [editAttachedFiles, setEditAttachedFiles] = useState<AttachmentItem[]>([]);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    async function loadPermissionStatus() {
      const res = await getJournalEditPermissionStatusAction();
      if (res.success) {
        setEditPermStatus(res.status as any);
        setPermRequestedAt(res.requestedAt);
        setPermProcessedAt(res.processedAt);
      }
    }
    loadPermissionStatus();
  }, []);

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

  const handleExportLedger = () => {
    const headers = [
      { key: "code", label: "Kode Akun" },
      { key: "name", label: "Nama Akun" },
      { key: "categoryLabel", label: "Kategori" },
      { key: "debit", label: "Debit (IDR)" },
      { key: "credit", label: "Kredit (IDR)" },
      { key: "balance", label: "Saldo Akhir (IDR)" },
    ];
    exportToCSV(ledgerAccounts, headers, "Laporan_Buku_Besar_Nanovest");
  };

  const handleRequestEditPermission = async () => {
    setIsRequestingPerm(true);
    const res = await requestJournalEditPermissionAction();
    setIsRequestingPerm(false);
    if (res.success) {
      setEditPermStatus("PENDING");
      alert(res.message);
      router.refresh();
    } else {
      alert(res.error || "Gagal mengajukan izin.");
    }
  };

  const handleApproveEditPermission = async (approved: boolean) => {
    const res = await approveJournalEditPermissionAction(approved);
    if (res.success) {
      setEditPermStatus(approved ? "APPROVED" : "REJECTED");
      alert(res.message);
      router.refresh();
    } else {
      alert(res.error || "Gagal memproses izin.");
    }
  };

  const handleUndoRevision = async (entryId: string, revisionNumber: number) => {
    if (!confirm(`Apakah Anda yakin ingin memulihkan jurnal ke Revisi #${revisionNumber}?`)) return;
    const res = await undoJournalEntryRevisionAction(entryId, revisionNumber);
    if (res.success) {
      alert(res.message);
      setViewingRevisionsEntry(null);
      router.refresh();
    } else {
      alert(res.error || "Gagal memulihkan revisi.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setMessage({ type: "error", text: "Deskripsi jurnal wajib diisi." });
      return;
    }

    const totalDebit = journalFormLines
      .filter((l) => l.side === "DEBIT")
      .reduce((sum, l) => sum + Number(l.amount), 0);
    const totalCredit = journalFormLines
      .filter((l) => l.side === "CREDIT")
      .reduce((sum, l) => sum + Number(l.amount), 0);

    if (totalDebit <= 0 || totalCredit <= 0) {
      setMessage({ type: "error", text: "Nominal total debit dan kredit harus lebih besar dari nol." });
      return;
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      setMessage({
        type: "error",
        text: `Jurnal tidak seimbang! Total Debit: ${formatCurrency(totalDebit)}, Total Kredit: ${formatCurrency(totalCredit)}.`,
      });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const finalDescription = formatAttachmentsMessage(description.trim(), attachedFiles);

    const result = await postJournalEntryAction({
      description: finalDescription,
      entryDate,
      lines: journalFormLines,
    });

    setIsSubmitting(false);
    if (result.success) {
      setMessage({ type: "success", text: result.message || "Jurnal balanced berhasil diposting." });
      setDescription("");
      setJournalFormLines([
        { side: "DEBIT", financeAccountId: accounts[0]?.id ?? "", amount: 0 },
        { side: "CREDIT", financeAccountId: accounts[1]?.id ?? accounts[0]?.id ?? "", amount: 0 },
      ]);
      setAttachedFiles([]);
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

  // Trigger Edit Mode
  const openEditModal = (entry: JournalEntryView) => {
    const { cleanDescription } = parseJournalRevisions(entry.description);
    const { text, attachments } = parseAttachments(cleanDescription);
    setEditingEntry(entry);
    setEditEntryDate(entry.entryDate.slice(0, 10));
    setEditDescription(text);
    setEditFormLines(
      entry.lines.map((l) => ({
        side: l.side as "DEBIT" | "CREDIT",
        financeAccountId: accounts.find((a) => a.code === l.accountCode)?.id || accounts[0]?.id || "",
        amount: l.amount,
      }))
    );
    setEditAttachedFiles(attachments);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    if (!editDescription.trim()) {
      alert("Deskripsi jurnal wajib diisi.");
      return;
    }

    setEditLoading(true);

    const result = await updateJournalEntryAction(editingEntry.id, {
      entryDate: editEntryDate,
      description: editDescription.trim(),
      lines: editFormLines,
      attachmentName: editAttachedFiles[0]?.name,
      attachmentData: editAttachedFiles[0]?.data,
    });
    setEditLoading(false);

    if (result.success) {
      setIsEditModalOpen(false);
      setEditingEntry(null);
      router.refresh();
    } else {
      alert(result.error || "Gagal memperbarui entri jurnal.");
    }
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

      {/* Visual Charts & Trial Balance Section (Side-by-Side like Overview Page) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1 (Left): Trial Balance Real-Time Metrics */}
        <div className="rounded-2xl border border-zinc-900 bg-zinc-900/30 backdrop-blur-xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Nanovest Accounting Requirement Showcase</h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Modul ini membaca chart of accounts dari database, menghitung total trial balance real-time, dan memvalidasi jurnal balanced secara otomatis.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold">
            {[
              { title: "Total Assets (Aset)", value: asset },
              { title: "Total Liabilities (Liabilitas)", value: liability },
              { title: "Total Equity (Ekuitas)", value: equity },
              { title: "Total Revenue (Pendapatan)", value: revenue },
              { title: "Total Expenses (Beban)", value: expense, colSpan: true },
            ].map((item) => (
              <div key={item.title} className={`rounded-xl border border-zinc-900 bg-zinc-950/60 p-3.5 ${item.colSpan ? "sm:col-span-2" : ""}`}>
                <span className="mb-1 block text-emerald-400 text-[11px]">{item.title}</span>
                <span className="font-medium text-zinc-200">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2 (Right): Financial Breakdown Donut & Operating Performance */}
        <div className="rounded-2xl border border-zinc-900 bg-zinc-900/30 backdrop-blur-xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Financial Breakdown Visualization</h3>
            <p className="text-xs text-zinc-500">Struktur Balance Sheet dan rasio pendapatan vs pengeluaran ledger.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Balance Sheet Donut Chart */}
            <div className="sm:col-span-5 flex flex-col items-center justify-center p-3 border border-zinc-900 rounded-xl bg-zinc-950/40">
              <h4 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">BS Structure</h4>
              <div className="relative h-28 w-28">
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
                  <span className="text-[8px] uppercase font-bold text-zinc-500">Total BS</span>
                  <span className="text-[10px] font-extrabold text-white">
                    {new Intl.NumberFormat("id-ID", { notation: "compact" }).format(totalBS)}
                  </span>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap justify-center gap-2 text-[9px] font-semibold">
                <span className="text-[#10b981]">A: {totalBS > 0 ? Math.round((asset / totalBS) * 100) : 0}%</span>
                <span className="text-[#f59e0b]">L: {totalBS > 0 ? Math.round((liability / totalBS) * 100) : 0}%</span>
                <span className="text-[#3b82f6]">E: {totalBS > 0 ? Math.round((equity / totalBS) * 100) : 0}%</span>
              </div>
            </div>

            {/* Operating Ratio */}
            <div className="sm:col-span-7 space-y-3 p-3.5 border border-zinc-900 rounded-xl bg-zinc-950/40">
              <div className="flex justify-between text-[11px] font-bold text-zinc-300">
                <span>Revenue / Expense</span>
                <span className="text-emerald-400">
                  {revenue + expense > 0 ? Math.round((revenue / (revenue + expense)) * 100) : 0}% / {revenue + expense > 0 ? Math.round((expense / (revenue + expense)) * 100) : 0}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-zinc-900 overflow-hidden flex">
                <div
                  style={{ width: `${revenue + expense > 0 ? (revenue / (revenue + expense)) * 100 : 0}%` }}
                  className="bg-emerald-500 transition-all duration-1000"
                />
                <div
                  style={{ width: `${revenue + expense > 0 ? (expense / (revenue + expense)) * 100 : 0}%` }}
                  className="bg-rose-500 transition-all duration-1000"
                />
              </div>

              <div className="pt-2 border-t border-zinc-900/60 flex justify-between items-center text-xs">
                <span className="text-zinc-500 font-medium text-[10px]">Estimated Profit:</span>
                <span className={`font-bold ${revenue >= expense ? "text-emerald-400" : "text-rose-400"}`}>
                  {revenue >= expense ? "+" : ""}
                  {formatCurrency(revenue - expense)}
                </span>
              </div>
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

          {/* Tabel Rincian & Jadwal Pajak Perusahaan (Task 4) */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Tabel Rincian & Jadwal Pajak Perusahaan (PPN, PPh & Badan)
                </h4>
              </div>
              {(userRole === "ADMIN" || userDivision === "Accounting") && (
                <button
                  type="button"
                  onClick={() => setIsEditingTaxDates(!isEditingTaxDates)}
                  className="px-3 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition self-start sm:self-auto cursor-pointer"
                >
                  {isEditingTaxDates ? "Selesai Menyunting" : "✏️ Sunting Tanggal Pajak"}
                </button>
              )}
            </div>

            {isEditingTaxDates && (
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                    Batas Akhir Pelaporan Pajak Utama (SPT)
                  </label>
                  <input
                    type="date"
                    value={taxFilingDeadline}
                    onChange={(e) => setTaxFilingDeadline(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-amber-500 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                    Batas Akhir Pembayaran Pajak Terdekat
                  </label>
                  <input
                    type="date"
                    value={taxPaymentDeadline}
                    onChange={(e) => setTaxPaymentDeadline(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-amber-500 [color-scheme:dark]"
                  />
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-900 text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="pb-2">Jenis Pajak</th>
                    <th className="pb-2">DPP</th>
                    <th className="pb-2">Tarif</th>
                    <th className="pb-2 text-right">Estimasi Terutang</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-center">Tanggal Pembayaran (Sudah Dibayar Pada)</th>
                    <th className="pb-2 text-center">Batas Pelaporan (SPT)</th>
                    <th className="pb-2 text-center">Batas Pembayaran</th>
                    <th className="pb-2 text-center">Lampiran Dokumen Pajak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60 text-zinc-300">
                  {[
                    { key: "ppn", name: "PPN (12% Masa Juli)", dpp: revenue, rate: "12%", est: revenue * 0.12, status: "Belum Disetor", fileDefault: "spt_ppn_juli.pdf" },
                    { key: "pph21", name: "PPh Pasal 21 (Gaji TER)", dpp: 145000000, rate: "TER Progressive", est: 11600000, status: "Belum Disetor", fileDefault: "bukti_potong_pph21.pdf" },
                    { key: "pph23", name: "PPh Pasal 23 (Jasa Vendor)", dpp: 45000000, rate: "2.0%", est: 900000, status: "Belum Disetor", fileDefault: "spt_pph23.pdf" },
                    { key: "pph42", name: "PPh Pasal 4(2) Sewa Gedung", dpp: 60000000, rate: "10.0%", est: 6000000, status: "Sudah Lunas", fileDefault: "ntpn_pph42_lunas.pdf" },
                    { key: "pphbadan", name: "PPh Badan (22% Profit)", dpp: netProfit > 0 ? netProfit : 0, rate: "22.0%", est: netProfit > 0 ? netProfit * 0.22 : 0, status: "Estimasi Terutang", fileDefault: "angsuran_pph25_badan.pdf" },
                  ].map((tax) => {
                    const files = taxAttachmentsMap[tax.key] || [];
                    return (
                      <tr key={tax.key}>
                        <td className="py-2.5 font-bold text-white">{tax.name}</td>
                        <td className="py-2.5 font-mono">{formatCurrency(tax.dpp)}</td>
                        <td className="py-2.5">{tax.rate}</td>
                        <td className="py-2.5 text-right font-mono text-emerald-400">{formatCurrency(tax.est)}</td>
                        <td className="py-2.5">
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded font-bold border ${
                              tax.status === "Sudah Lunas"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            }`}
                          >
                            {tax.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-center font-mono text-emerald-400">
                          {isEditingTaxDates ? (
                            <input
                              type="text"
                              value={taxPaymentDates[tax.key] || ""}
                              onChange={(e) =>
                                setTaxPaymentDates((prev) => ({ ...prev, [tax.key]: e.target.value }))
                              }
                              className="w-28 rounded bg-zinc-950 border border-zinc-800 px-2 py-1 text-[11px] text-center text-emerald-300 outline-none"
                            />
                          ) : (
                            taxPaymentDates[tax.key] || taxPaymentDeadline
                          )}
                        </td>
                        <td className="py-2.5 text-center font-mono text-zinc-400">{taxFilingDeadline}</td>
                        <td className="py-2.5 text-center font-mono text-amber-300">{taxPaymentDeadline}</td>
                        <td className="py-2.5 text-center">
                          {isEditingTaxDates ? (
                            <MultiFileUploader
                              files={files}
                              onChange={(newFiles) =>
                                setTaxAttachmentsMap((prev) => ({ ...prev, [tax.key]: newFiles }))
                              }
                              label="Upload Dokumen Pajak"
                            />
                          ) : files.length > 0 ? (
                            <div className="flex flex-col gap-1 items-center">
                              {files.map((f, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() =>
                                    setActiveViewerFile({
                                      name: f.name,
                                      data: f.data,
                                    })
                                  }
                                  className="text-[9px] font-bold text-emerald-400 hover:underline block truncate max-w-[120px]"
                                >
                                  📁 {f.name}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-zinc-600 italic">Belum ada berkas</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-zinc-800 font-bold text-white bg-zinc-900/30">
                    <td className="py-3" colSpan={3}>
                      Total Estimasi Kewajiban Pajak Terutang
                    </td>
                    <td className="py-3 text-right font-mono text-emerald-400">
                      {formatCurrency(revenue * 0.12 + 11600000 + 900000 + 6000000 + (netProfit > 0 ? netProfit * 0.22 : 0))}
                    </td>
                    <td colSpan={5} className="py-3 text-center font-mono text-xs text-amber-400">
                      Pelaporan Akhir (SPT): <span className="underline">{taxFilingDeadline}</span> | Pembayaran Akhir: <span className="underline">{taxPaymentDeadline}</span>
                    </td>
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
                <span className="font-semibold text-emerald-400 block">Kesehatan Finansial Perusahaan & Deteksi Anomali</span>
                {loadingInsights ? (
                  <div className="space-y-2 py-1 animate-pulse">
                    <div className="h-3 bg-zinc-850 rounded w-3/4"></div>
                    <div className="h-3 bg-zinc-850 rounded w-5/6"></div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">
                    {aiInsights ? aiInsights.companyHealth : `Status Laba Bersih: ${formatCurrency(netProfit)}. Struktur keuangan perusahaan dinilai ${isHealthy ? "SANGAT SEHAT" : "PERLU EVALUASI"} dengan penutupan aset terhadap liabilitas 2.4x. [Anomali & Efisiensi]: Disarankan optimasi beban perawatan IT dan negosiasi alokasi vendor untuk meningkatkan margin.`}
                  </p>
                )}
              </div>
              <div className="space-y-2 p-3.5 border border-zinc-900 bg-zinc-900/20 rounded-xl relative overflow-hidden">
                <span className="font-semibold text-emerald-400 block">Saran Estimasi & Jadwal Kewajiban Pajak</span>
                {loadingInsights ? (
                  <div className="space-y-2 py-1 animate-pulse">
                    <div className="h-3 bg-zinc-850 rounded w-2/3"></div>
                    <div className="h-3 bg-zinc-850 rounded w-full"></div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">
                    {aiInsights ? aiInsights.taxAdvice : `Berdasarkan pendapatan berjalan, estimasi PPN Terutang (12%) adalah ${formatCurrency(revenue * 0.12)} dan PPh Badan (22%) adalah ${formatCurrency(netProfit > 0 ? netProfit * 0.22 : 0)}. [Jadwal Terdekat]: Batas akhir pembetulan & penyetoran PPN Masa Juli adalah ${taxPaymentDeadline}. Penyetoran PPh 21/23 paling lambat 10 Agustus 2026 dan pelaporan SPT Masa ${taxFilingDeadline}.`}
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

            {userRole === "HR" ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-6 text-center space-y-2">
                <span className="text-xl block">🔒</span>
                <p className="font-semibold text-zinc-400">Akses Terbatas (Read-Only)</p>
                <p className="text-zinc-500 leading-relaxed text-[11px]">
                  Akun HR Specialist diperbolehkan melihat data laporan buku besar ini, namun tidak memiliki wewenang untuk menambahkan atau merubah entri jurnal.
                </p>
              </div>
            ) : (
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
                    Deskripsi / Catatan Jurnal
                  </label>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Contoh: Tambahan Modal Disetor & Liabilitas Sewa"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-emerald-500/80"
                  />
                </div>

                {/* Compound Journal Lines Builder (1 Debit & Multiple Credits or Vice Versa) */}
                <div className="space-y-3 p-4 border border-zinc-900 bg-zinc-950/60 rounded-xl">
                  <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Detail Baris Jurnal (Debit & Kredit)
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setJournalFormLines((prev) => [
                            ...prev,
                            { side: "DEBIT", financeAccountId: accounts[0]?.id ?? "", amount: 0 },
                          ])
                        }
                        className="px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
                      >
                        + Baris Debit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setJournalFormLines((prev) => [
                            ...prev,
                            { side: "CREDIT", financeAccountId: accounts[1]?.id ?? accounts[0]?.id ?? "", amount: 0 },
                          ])
                        }
                        className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-[10px] font-bold text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
                      >
                        + Baris Kredit
                      </button>
                    </div>
                  </div>

                  {journalFormLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-3">
                        <select
                          value={line.side}
                          onChange={(e) => {
                            const val = e.target.value as "DEBIT" | "CREDIT";
                            setJournalFormLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, side: val } : l))
                            );
                          }}
                          className={`w-full rounded-lg border px-2 py-1.5 text-xs font-bold outline-none ${
                            line.side === "DEBIT"
                              ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-400"
                              : "border-amber-500/30 bg-amber-950/40 text-amber-400"
                          }`}
                        >
                          <option value="DEBIT">DEBIT</option>
                          <option value="CREDIT">CREDIT</option>
                        </select>
                      </div>

                      <div className="col-span-5">
                        <select
                          value={line.financeAccountId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setJournalFormLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, financeAccountId: val } : l))
                            );
                          }}
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-white outline-none"
                        >
                          {ledgerAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.code} {account.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          placeholder="Nominal"
                          value={line.amount || ""}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setJournalFormLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, amount: val } : l))
                            );
                          }}
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs font-mono text-white outline-none"
                        />
                      </div>

                      <div className="col-span-1 text-center">
                        {journalFormLines.length > 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              setJournalFormLines((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-zinc-500 hover:text-rose-400 font-bold text-sm cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 border-t border-zinc-900 flex justify-between items-center text-[11px] font-mono">
                    {(() => {
                      const deb = journalFormLines
                        .filter((l) => l.side === "DEBIT")
                        .reduce((acc, l) => acc + Number(l.amount), 0);
                      const cred = journalFormLines
                        .filter((l) => l.side === "CREDIT")
                        .reduce((acc, l) => acc + Number(l.amount), 0);
                      const isBalanced = deb > 0 && Math.abs(deb - cred) < 0.01;
                      return (
                        <>
                          <span className="text-zinc-400">
                            Total Debit: <span className="text-emerald-400 font-bold">{formatCurrency(deb)}</span> | Total Kredit: <span className="text-amber-400 font-bold">{formatCurrency(cred)}</span>
                          </span>
                          <span className={`font-bold px-2 py-0.5 rounded ${isBalanced ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"}`}>
                            {isBalanced ? "Balanced ✔" : "Unbalanced ✕"}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Multi-File Upload Field */}
                <MultiFileUploader
                  files={attachedFiles}
                  onChange={setAttachedFiles}
                  label="Lampiran Berkas Bukti (PDF, PNG, JPG, JPEG, DOCX, TXT)"
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-xs font-semibold text-black transition hover:opacity-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Menyimpan..." : "Post Balanced Entry"}
                </button>
              </form>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="text-base font-bold text-white">Recent Journal Entries</h3>

              {/* Edit Permission Workflow (Requirement 3 & 4) */}
              {userRole !== "HR" && userRole !== "ADMIN" && (
                <div>
                  {editPermStatus === "NONE" || editPermStatus === "REJECTED" ? (
                    <button
                      type="button"
                      onClick={handleRequestEditPermission}
                      disabled={isRequestingPerm}
                      className="px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition cursor-pointer"
                    >
                      🔓 Minta Izin Perubahan Jurnal
                    </button>
                  ) : editPermStatus === "PENDING" ? (
                    <span className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl font-medium">
                      ⏳ Menunggu Persetujuan Admin {permRequestedAt && `(Diajukan: ${new Date(permRequestedAt).toLocaleDateString("id-ID")})`}
                    </span>
                  ) : (
                    <span className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl font-medium">
                      ✅ Izin Perubahan Disetujui Admin {permRequestedAt && `(Diajukan: ${new Date(permRequestedAt).toLocaleDateString("id-ID")}`} {permProcessedAt && `| Diproses: ${new Date(permProcessedAt).toLocaleDateString("id-ID")})`}
                    </span>
                  )}
                </div>
              )}

              {userRole === "ADMIN" && editPermStatus === "PENDING" && (
                <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-3 text-xs">
                  <span className="text-amber-300 font-medium">Accountant mengajukan izin perubahan jurnal.</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApproveEditPermission(true)}
                      className="px-2.5 py-1 rounded bg-emerald-500 text-black font-bold text-[10px] hover:bg-emerald-400 transition"
                    >
                      Setujui Izin
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveEditPermission(false)}
                      className="px-2.5 py-1 rounded bg-rose-500 text-white font-bold text-[10px] hover:bg-rose-400 transition"
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {entries.length === 0 ? (
                <div className="text-zinc-500 text-xs text-center py-4">Belum ada jurnal masuk.</div>
              ) : (
                entries.map((entry) => {
                  const { cleanDescription, revisions } = parseJournalRevisions(entry.description);
                  const { text, attachments } = parseAttachments(cleanDescription);
                  const lastEdited = revisions.length > 0 ? revisions[revisions.length - 1].editedAt : null;
                  const canEdit = userRole === "ADMIN" || (userRole !== "HR" && editPermStatus === "APPROVED");
                  const showRevisions = userRole === "ADMIN" || (userRole !== "HR" && editPermStatus === "APPROVED");

                  return (
                    <div key={entry.id} className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{entry.reference}</span>
                            {showRevisions && revisions.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingRevisionsEntry({
                                    id: entry.id,
                                    reference: entry.reference,
                                    revisions,
                                  })
                                }
                                className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20 hover:bg-emerald-500/20 transition cursor-pointer"
                              >
                                📜 Riwayat ({revisions.length})
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-zinc-300 mt-1">{text}</p>
                          <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500 mt-1 font-mono">
                            <span>Di-entry: {new Date(entry.entryDate).toLocaleDateString("id-ID")}</span>
                            {showRevisions && lastEdited && (
                              <span className="text-emerald-400">
                                Disunting: {new Date(lastEdited).toLocaleString("id-ID")}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div className="flex gap-2 items-center">
                            {userRole !== "HR" && (
                              <>
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(entry)}
                                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase transition cursor-pointer"
                                  >
                                    Sunting
                                  </button>
                                )}
                                {userRole === "ADMIN" && (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(entry.id)}
                                    disabled={isDeleting === entry.id}
                                    className="text-[10px] text-rose-500 hover:text-rose-400 font-bold uppercase transition disabled:opacity-50 cursor-pointer"
                                  >
                                    Hapus
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Display Multi-File Attachments */}
                      {attachments.length > 0 && (
                        <div className="mt-2.5 space-y-1.5">
                          {attachments.map((file, idx) => (
                            <div
                              key={idx}
                              className="p-2 border border-zinc-900 bg-zinc-950 rounded-xl flex items-center justify-between text-xs"
                            >
                              <span className="text-zinc-400 truncate max-w-[170px] font-mono text-[10px]">
                                📁 {file.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveViewerFile({
                                    name: file.name,
                                    data: file.data,
                                    entryId: entry.id,
                                  });
                                }}
                                className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 uppercase transition cursor-pointer"
                              >
                                Lihat Berkas
                              </button>
                            </div>
                          ))}
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

      {/* Floating Chat Widget */}
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
                type="button"
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
          type="button"
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="h-16 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-black font-bold text-2xl shadow-xl hover:scale-105 active:scale-95 transition cursor-pointer"
          title="Tanya Finance AI"
        >
          💬
        </button>
      </div>

      {/* Revision History Modal (Item 3.2: Up to 10 Revisions) */}
      {viewingRevisionsEntry && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl max-w-lg w-full space-y-4 text-xs text-left max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start border-b border-zinc-800 pb-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Riwayat Perubahan Jurnal</h3>
                <span className="text-[10px] text-emerald-400 font-mono mt-0.5 block">
                  Entry Reference: {viewingRevisionsEntry.reference} (Hingga 10 Perubahan Terakhir)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingRevisionsEntry(null)}
                className="text-zinc-400 hover:text-white transition font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {viewingRevisionsEntry.revisions.length === 0 ? (
                <p className="text-zinc-500 text-center py-4">Belum ada riwayat penyuntingan.</p>
              ) : (
                viewingRevisionsEntry.revisions.slice(-10).map((rev, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950 space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 border-b border-zinc-900 pb-1.5">
                      <span className="font-bold text-emerald-400">Revisi #{rev.revisionNumber}</span>
                      <div className="flex items-center gap-2">
                        <span>Disunting: {new Date(rev.editedAt).toLocaleString("id-ID")}</span>
                        {userRole === "ADMIN" && viewingRevisionsEntry.id && (
                          <button
                            type="button"
                            onClick={() => handleUndoRevision(viewingRevisionsEntry.id!, rev.revisionNumber)}
                            className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-bold hover:bg-rose-500/30 transition cursor-pointer"
                          >
                            ↩️ Pulihkan / Undo
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded bg-red-950/20 border border-red-900/40 text-red-300">
                        <span className="text-[9px] font-bold uppercase text-red-400 block mb-1">Sebelum:</span>
                        <p>{rev.oldDescription}</p>
                        {rev.oldDate && <span className="text-[9px] text-zinc-500 block mt-1">Tanggal: {rev.oldDate}</span>}
                      </div>
                      <div className="p-2 rounded bg-emerald-950/20 border border-emerald-900/40 text-emerald-300">
                        <span className="text-[9px] font-bold uppercase text-emerald-400 block mb-1">Sesudah:</span>
                        <p>{rev.newDescription}</p>
                        {rev.newDate && <span className="text-[9px] text-zinc-500 block mt-1">Tanggal: {rev.newDate}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-zinc-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewingRevisionsEntry(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-semibold hover:bg-zinc-700 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin/Accountant Edit Journal Entry Modal */}
      {isEditModalOpen && editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl max-w-lg w-full space-y-4 text-xs text-left max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sunting Jurnal Entry ({editingEntry.reference})</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-400 hover:text-white transition font-bold"
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
                  Deskripsi / Catatan Jurnal
                </label>
                <input
                  type="text"
                  required
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-white outline-none focus:border-emerald-500/80"
                />
              </div>

              {/* Edit Lines Builder */}
              <div className="space-y-3 p-3 border border-zinc-800 bg-zinc-950/60 rounded-xl">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                    Sunting Baris Akun Debit & Kredit
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditFormLines((prev) => [
                          ...prev,
                          { side: "DEBIT", financeAccountId: accounts[0]?.id ?? "", amount: 0 },
                        ])
                      }
                      className="px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-[9px] font-bold text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                    >
                      + Debit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditFormLines((prev) => [
                          ...prev,
                          { side: "CREDIT", financeAccountId: accounts[1]?.id ?? accounts[0]?.id ?? "", amount: 0 },
                        ])
                      }
                      className="px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-[9px] font-bold text-amber-400 hover:bg-amber-500/20 cursor-pointer"
                    >
                      + Kredit
                    </button>
                  </div>
                </div>

                {editFormLines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                    <div className="col-span-3">
                      <select
                        value={line.side}
                        onChange={(e) => {
                          const val = e.target.value as "DEBIT" | "CREDIT";
                          setEditFormLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, side: val } : l))
                          );
                        }}
                        className={`w-full rounded border px-2 py-1 text-xs font-bold outline-none ${
                          line.side === "DEBIT"
                            ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-400"
                            : "border-amber-500/30 bg-amber-950/40 text-amber-400"
                        }`}
                      >
                        <option value="DEBIT">DEBIT</option>
                        <option value="CREDIT">CREDIT</option>
                      </select>
                    </div>

                    <div className="col-span-5">
                      <select
                        value={line.financeAccountId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditFormLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, financeAccountId: val } : l))
                          );
                        }}
                        className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white outline-none"
                      >
                        {ledgerAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} {account.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={line.amount || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditFormLines((prev) =>
                            prev.map((l, i) => (i === idx ? { ...l, amount: val } : l))
                          );
                        }}
                        className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs font-mono text-white outline-none"
                      />
                    </div>

                    <div className="col-span-1 text-center">
                      {editFormLines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setEditFormLines((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-zinc-500 hover:text-rose-400 font-bold text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Multi-File Upload in Edit Modal */}
              <MultiFileUploader
                files={editAttachedFiles}
                onChange={setEditAttachedFiles}
                label="Kelola Lampiran Berkas (PDF, PNG, JPG, JPEG, DOCX, TXT)"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-black font-semibold hover:opacity-95 disabled:opacity-50 cursor-pointer"
                >
                  {editLoading ? "Menyimpan..." : "Simpan Perubahan (Catat Revisi)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {activeViewerFile && (
        <FileViewerModal
          fileName={activeViewerFile.name}
          fileData={activeViewerFile.data}
          editedAt={activeViewerFile.editedAt}
          readOnly={userRole === "HR"}
          onClose={() => setActiveViewerFile(null)}
          onSaveText={async (newText) => {
            const res = await updateJournalEntryAttachmentAction(activeViewerFile.entryId!, newText);
            if (res.success && res.data) {
              setActiveViewerFile((prev) =>
                prev
                  ? {
                      ...prev,
                      data: Buffer.from(newText, "utf-8").toString("base64"),
                      editedAt: (res.data as any).metadata?.editedAt || null,
                    }
                  : null
              );
              router.refresh();
            }
            return res;
          }}
        />
      )}
    </div>
  );
}
