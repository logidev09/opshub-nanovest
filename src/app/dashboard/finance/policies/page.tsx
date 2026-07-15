"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  getFinancePoliciesAction,
  updateFinancePolicyAction,
  createFinancePolicyAction,
  deleteFinancePolicyAction,
  extractFinanceDocumentTextAction,
} from "@/features/finance/actions/policy.actions";

interface Policy {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  metadata: any;
}

export default function FinancePoliciesPage() {
  const { data: session } = useSession();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Editor states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("finance_tax");

  // Attachment states (for new upload)
  const [attachmentName, setAttachmentName] = useState<string>("");
  const [attachmentData, setAttachmentData] = useState<string>("");

  async function loadPolicies(selectId?: string) {
    setFetching(true);
    const res = await getFinancePoliciesAction();
    if (res.success && res.data) {
      const data = res.data as unknown as Policy[];
      setPolicies(data);
      if (data.length > 0) {
        if (selectId) {
          const found = data.find((d) => d.id === selectId);
          if (found) {
            selectPolicy(found);
            setIsCreateMode(false);
            setFetching(false);
            return;
          }
        }
        selectPolicy(data[0]);
        setIsCreateMode(false);
      } else {
        triggerCreateMode();
      }
    }
    setFetching(false);
  }

  useEffect(() => {
    loadPolicies();
  }, []);

  const selectPolicy = (p: Policy) => {
    setSelectedPolicy(p);
    setIsCreateMode(false);
    setTitle(p.title);
    setContent(p.content);
    setCategory(p.category);
    setAttachmentName("");
    setAttachmentData("");
    setMessage(null);
  };

  const triggerCreateMode = () => {
    setSelectedPolicy(null);
    setIsCreateMode(true);
    setTitle("");
    setContent("");
    setCategory("finance_tax");
    setAttachmentName("");
    setAttachmentData("");
    setMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (isCreateMode) {
      const res = await createFinancePolicyAction({
        title,
        content,
        category,
        attachmentName: attachmentName || undefined,
        attachmentData: attachmentData || undefined,
      });
      setLoading(false);
      if (res.success && res.data) {
        setMessage({ type: "success", text: "Dokumen perpajakan/PSAK baru berhasil disimpan!" });
        await loadPolicies((res.data as any).id);
      } else {
        setMessage({ type: "error", text: res.error || "Gagal menyimpan dokumen baru." });
      }
    } else {
      if (!selectedPolicy) return;
      const res = await updateFinancePolicyAction(selectedPolicy.id, {
        title,
        content,
        category,
      });
      setLoading(false);
      if (res.success) {
        setMessage({ type: "success", text: "Dokumen berhasil diperbarui!" });
        await loadPolicies(selectedPolicy.id);
      } else {
        setMessage({ type: "error", text: res.error || "Gagal memperbarui dokumen." });
      }
    }
  };

  const handleDelete = async () => {
    if (!selectedPolicy) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus dokumen "${selectedPolicy.title}"?`)) return;

    setLoading(true);
    setMessage(null);
    const res = await deleteFinancePolicyAction(selectedPolicy.id);
    setLoading(false);

    if (res.success) {
      setMessage({ type: "success", text: "Dokumen berhasil dihapus!" });
      await loadPolicies();
    } else {
      setMessage({ type: "error", text: res.error || "Gagal menghapus dokumen." });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      const res = await extractFinanceDocumentTextAction(base64, file.name);
      
      if (res.success && res.data) {
        setTitle(res.data.title);
        setCategory(res.data.category);
        setContent(res.data.content);
        setAttachmentName(file.name);
        setAttachmentData(base64);
        setMessage({ type: "success", text: `Dokumen ${file.name} berhasil diekstrak dengan Groq AI!` });
      } else {
        setMessage({ type: "error", text: res.error || "Gagal mengekstrak dokumen." });
      }
      setExtracting(false);
    };
    reader.onerror = () => {
      setMessage({ type: "error", text: "Gagal membaca file lokal." });
      setExtracting(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadAttachment = (p: Policy) => {
    const metadata = p.metadata as any;
    if (!metadata || !metadata.attachmentData || !metadata.attachmentName) {
      alert("Tidak ada lampiran file asli untuk dokumen ini.");
      return;
    }

    const downloadLink = document.createElement("a");
    downloadLink.href = `data:application/octet-stream;base64,${metadata.attachmentData}`;
    downloadLink.download = metadata.attachmentName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // Format category display label
  const getCategoryLabel = (cat: string) => {
    if (cat === "finance_tax") return "Pajak / Tax";
    if (cat === "finance_psak") return "PSAK";
    if (cat === "finance_ifrs") return "IFRS";
    return "Regulasi / SOP";
  };

  // Restrict access to Accounting and ADMIN only
  const userDivision = (session?.user as any)?.division;
  const userRole = (session?.user as any)?.role;
  const isAuthorized = userRole === "ADMIN" || userDivision === "Accounting";

  if (fetching && policies.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto mb-4" />
          <p className="text-zinc-500 text-xs">Memuat basis aturan keuangan...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-8 text-center max-w-lg mx-auto mt-12">
        <span className="text-2xl">🔒</span>
        <h2 className="text-lg font-bold text-red-400 mt-2">Akses Ditolak</h2>
        <p className="text-zinc-400 text-sm mt-1 leading-relaxed">
          Maaf, halaman basis pengetahuan keuangan RAG ini hanya dapat diakses oleh Admin atau Accountant.
        </p>
        <Link
          href="/dashboard/finance"
          className="mt-4 inline-flex px-4 py-2 bg-zinc-900 border border-zinc-800 text-xs font-semibold rounded-lg text-zinc-300 hover:text-white transition"
        >
          Kembali ke Finance Ledger
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Finance Document Base Manager</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Kelola dokumen panduan PSAK, IFRS Juli 2026, dan ketentuan perpajakan terbaru sebagai basis pengetahuan Finance AI.
          </p>
        </div>
        <div>
          <Link
            href="/dashboard/finance"
            className="inline-flex px-4 py-2 border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition duration-150 items-center gap-1.5"
          >
            ← Kembali ke Ledger
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Document List (Col 4) */}
        <div className="lg:col-span-4 rounded-2xl border border-zinc-900 bg-zinc-900/10 p-4 h-[70vh] flex flex-col">
          <div className="flex justify-between items-center mb-4 px-2">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Basis Pengetahuan ({policies.length})</h3>
            <button
              onClick={triggerCreateMode}
              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold transition active:scale-95"
            >
              + Tambah Dokumen
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {policies.length === 0 ? (
              <p className="text-zinc-600 text-xs text-center py-8">Belum ada dokumen perpajakan.</p>
            ) : (
              policies.map((p) => {
                const isSelected = !isCreateMode && selectedPolicy?.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPolicy(p)}
                    className={`w-full text-left p-3.5 rounded-xl border transition ${
                      isSelected
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : "border-zinc-900 bg-zinc-950/40 text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-bold truncate max-w-[170px]">{p.title}</span>
                      <span className="text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-zinc-900 font-semibold text-zinc-500">
                        {getCategoryLabel(p.category)}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 truncate mt-1 leading-normal">
                      {p.content.substring(0, 80)}...
                    </p>
                    <div className="flex justify-between items-center text-[8px] text-zinc-600 mt-2">
                      <span>Versi: {(p.metadata as any)?.version || "1.0"}</span>
                      <span>Update: {new Date(p.updatedAt).toLocaleDateString("id-ID")}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Text Editor (Col 8) */}
        <div className="lg:col-span-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col h-[70vh]">
          <form onSubmit={handleSave} className="flex-1 flex flex-col space-y-4">
            <div className="flex justify-between items-center gap-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-zinc-400">
                {isCreateMode ? "Tambah Kebijakan Keuangan" : "Sunting Dokumen Editor"}
              </h3>
              {message && (
                <span
                  className={`text-xs font-bold ${
                    message.type === "success" ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {message.text}
                </span>
              )}
            </div>

            {/* AI Uploader (Create Mode only) */}
            {isCreateMode && (
              <div className="p-3.5 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/40 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-zinc-300">Ekstrak PSAK/Pajak via AI (Groq LLM)</h4>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Unggah berkas PDF, TXT, atau DOCX. AI akan memformat & mengkategorikan secara otomatis.</p>
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.txt,.docx"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                    disabled={extracting}
                  />
                  <button
                    type="button"
                    className="px-3.5 py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-emerald-500/50 hover:bg-zinc-750 text-[10px] font-semibold text-zinc-300 transition"
                  >
                    {extracting ? "Mengekstrak..." : "Pilih File"}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Judul Dokumen Keuangan
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-white outline-none focus:border-emerald-500/80 transition"
                  placeholder="Contoh: Pedoman Pengakuan Pendapatan PSAK 72"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-white outline-none focus:border-emerald-500/80 transition"
                >
                  <option value="finance_tax">Pajak / Tax</option>
                  <option value="finance_psak">PSAK</option>
                  <option value="finance_ifrs">IFRS</option>
                  <option value="finance_regulation">Regulasi / SOP</option>
                </select>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                Isi Aturan / Ketentuan
              </label>
              <textarea
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs text-white outline-none focus:border-emerald-500/80 transition resize-none font-mono leading-relaxed"
                placeholder="Ketik detail isi regulasi di sini..."
              />
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-zinc-900">
              <div className="flex flex-col gap-1 text-[10px] text-zinc-500">
                {!isCreateMode && selectedPolicy && (
                  <>
                    <span>ID: <code className="text-zinc-400 font-mono">{selectedPolicy.id}</code></span>
                    <span>Dibuat: {new Date(selectedPolicy.createdAt).toLocaleString("id-ID")}</span>
                  </>
                )}
                {isCreateMode && attachmentName && (
                  <span className="text-emerald-400">File Terlampir: {attachmentName}</span>
                )}
              </div>
              <div className="flex gap-2">
                {!isCreateMode && selectedPolicy && (
                  <>
                    {(selectedPolicy.metadata as any)?.attachmentData && (
                      <button
                        type="button"
                        onClick={() => handleDownloadAttachment(selectedPolicy)}
                        className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 font-semibold hover:border-zinc-700 transition active:scale-[0.98] text-xs"
                      >
                        Unduh Berkas
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleDelete}
                      className="px-4 py-2.5 rounded-xl bg-red-950/40 border border-red-900/50 text-red-400 font-semibold hover:bg-red-950/80 disabled:opacity-50 transition active:scale-[0.98] text-xs"
                    >
                      Hapus
                    </button>
                  </>
                )}
                <button
                  type="submit"
                  disabled={loading || extracting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold hover:opacity-95 disabled:opacity-50 transition active:scale-[0.98] text-xs"
                >
                  {loading ? "Menyimpan..." : isCreateMode ? "Simpan Dokumen" : "Simpan Perubahan RAG"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
