"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getPoliciesAction, updatePolicyAction } from "@/features/hr/actions/policy.actions";

interface Policy {
  id: string;
  title: string;
  content: string;
  category: string;
  updatedAt: Date | string;
  metadata: any;
}

export default function HrPoliciesPage() {
  const { data: session } = useSession();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Editor states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("leave");

  async function loadPolicies() {
    setFetching(true);
    const res = await getPoliciesAction();
    if (res.success && res.data) {
      const data = res.data as unknown as Policy[];
      setPolicies(data);
      if (data.length > 0) {
        selectPolicy(data[0]);
      }
    }
    setFetching(false);
  }

  useEffect(() => {
    loadPolicies();
  }, []);

  const selectPolicy = (p: Policy) => {
    setSelectedPolicy(p);
    setTitle(p.title);
    setContent(p.content);
    setCategory(p.category);
    setMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPolicy) return;
    setLoading(true);
    setMessage(null);

    const res = await updatePolicyAction(selectedPolicy.id, {
      title,
      content,
      category,
    });

    setLoading(false);

    if (res.success) {
      setMessage({ type: "success", text: "Dokumen kebijakan berhasil diperbarui!" });
      // Reload list and re-select updated policy
      await loadPolicies();
    } else {
      setMessage({ type: "error", text: res.error || "Gagal memperbarui dokumen kebijakan." });
    }
  };

  // Restrict access to HR and ADMIN only
  const userRole = (session?.user as any)?.role;
  const isAuthorized = userRole === "HR" || userRole === "ADMIN";

  if (fetching) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto mb-4" />
          <p className="text-zinc-500 text-xs">Memuat dokumen kebijakan...</p>
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
          Maaf, halaman pengelolaan basis pengetahuan RAG ini hanya dapat diakses oleh Admin atau HR Specialist.
        </p>
        <Link
          href="/dashboard/hr"
          className="mt-4 inline-flex px-4 py-2 bg-zinc-900 border border-zinc-800 text-xs font-semibold rounded-lg text-zinc-300 hover:text-white transition"
        >
          Kembali ke Dashboard HR
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">HR Policy Knowledge Base Manager</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Lihat dan sunting dokumen aturan internal yang menjadi basis pengetahuan sistem AI HR Copilot.
          </p>
        </div>
        <div>
          <Link
            href="/dashboard/hr"
            className="inline-flex px-4 py-2 border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 hover:border-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl transition duration-150 items-center gap-1.5"
          >
            ← Kembali ke Copilot
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Document List (Col 4) */}
        <div className="lg:col-span-4 rounded-2xl border border-zinc-900 bg-zinc-900/10 p-4 h-[70vh] flex flex-col">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 px-2">Daftar Dokumen ({policies.length})</h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {policies.map((p) => {
              const isSelected = selectedPolicy?.id === p.id;
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
                    <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-zinc-900 font-semibold text-zinc-500">
                      {p.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 truncate mt-1 leading-normal">
                    {p.content.substring(0, 80)}...
                  </p>
                  <span className="text-[8px] text-zinc-600 block mt-1.5">
                    Versi: {(p.metadata as any)?.version || "1.0"} · Update:{" "}
                    {new Date(p.updatedAt).toLocaleDateString("id-ID")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Text Editor (Col 8) */}
        <div className="lg:col-span-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col h-[70vh]">
          {selectedPolicy ? (
            <form onSubmit={handleSave} className="flex-1 flex flex-col space-y-4">
              <div className="flex justify-between items-center gap-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider text-zinc-400">
                  Built-in Document Editor
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

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Judul Dokumen
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-white outline-none focus:border-emerald-500/80 transition"
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
                    <option value="leave">Cuti / Leave</option>
                    <option value="payroll">Gaji / Payroll</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="regulation">Regulasi / SOP</option>
                  </select>
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                <label className="block text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Isi Dokumen Ketentuan
                </label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="flex-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs text-white outline-none focus:border-emerald-500/80 transition resize-none font-mono leading-relaxed"
                  placeholder="Ketik detail isi dokumen di sini..."
                />
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-zinc-900">
                <span className="text-[10px] text-zinc-500">
                  ID: <code className="text-zinc-400 font-mono">{selectedPolicy.id}</code>
                </span>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold hover:opacity-95 disabled:opacity-50 transition active:scale-[0.98] text-xs"
                >
                  {loading ? "Menyimpan..." : "Simpan Perubahan RAG"}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <span className="text-2xl">📝</span>
                <p className="text-zinc-500 text-xs mt-2">Pilih dokumen di sebelah kiri untuk disunting.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
