"use client";

import { useState } from "react";

interface FileViewerModalProps {
  fileName: string;
  fileData: string; // base64 string
  editedAt?: string | null;
  onClose: () => void;
  onSaveText?: (newText: string) => Promise<{ success: boolean; error?: string }>;
}

export function FileViewerModal({
  fileName,
  fileData,
  editedAt,
  onClose,
  onSaveText,
}: FileViewerModalProps) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const isImage = ["png", "jpg", "jpeg", "webp"].includes(ext);
  const isPdf = ext === "pdf";
  const isTxt = ext === "txt";

  // Decode base64 to string for TXT files
  const initialText = isTxt
    ? typeof window !== "undefined"
      ? window.atob(fileData)
      : Buffer.from(fileData, "base64").toString("utf-8")
    : "";

  const [textVal, setTextVal] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async () => {
    if (!onSaveText) return;
    setSaving(true);
    setMsg(null);
    const res = await onSaveText(textVal);
    setSaving(false);
    if (res.success) {
      setMsg({ type: "success", text: "Isi file berhasil diperbarui!" });
    } else {
      setMsg({ type: "error", text: res.error || "Gagal memperbarui file." });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 bg-zinc-950/60 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">File Viewer</h3>
            <span className="text-[10px] text-zinc-500 font-mono mt-0.5 block">{fileName}</span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-zinc-850 text-zinc-400 hover:text-white transition flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-950/20 text-xs">
          {isImage && (
            <div className="flex justify-center items-center py-4 bg-zinc-950/50 rounded-xl border border-zinc-900">
              <img
                src={`data:image/${ext === "jpg" ? "jpeg" : ext};base64,${fileData}`}
                alt={fileName}
                className="max-h-[55vh] object-contain rounded-lg"
              />
            </div>
          )}

          {isPdf && (
            <div className="h-[55vh] rounded-xl overflow-hidden border border-zinc-900">
              <embed
                src={`data:application/pdf;base64,${fileData}#toolbar=0`}
                type="application/pdf"
                className="w-full h-full"
              />
            </div>
          )}

          {isTxt && (
            <div className="flex flex-col h-[50vh] space-y-4">
              <div className="flex justify-between items-center text-[10px] text-zinc-500">
                <span>Ekstensi file teks dapat langsung disunting:</span>
                {editedAt && (
                  <span className="text-emerald-400 font-semibold">
                    Terakhir diubah: {new Date(editedAt).toLocaleString("id-ID")}
                  </span>
                )}
              </div>
              <textarea
                value={textVal}
                onChange={(e) => setTextVal(e.target.value)}
                className="flex-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs font-mono text-zinc-300 outline-none focus:border-emerald-500/80 resize-none leading-relaxed"
              />
            </div>
          )}

          {!isImage && !isPdf && !isTxt && (
            <div className="py-12 text-center space-y-3">
              <span className="text-4xl block">📁</span>
              <p className="text-zinc-400">Berkas bertipe <strong>.{ext.toUpperCase()}</strong> tidak dapat dibuka langsung.</p>
              <p className="text-zinc-600 text-[10px]">Silakan klik tombol download di bawah untuk membacanya di komputer Anda.</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-xs">
            {msg && (
              <span className={msg.type === "success" ? "text-emerald-400 font-semibold" : "text-red-400"}>
                {msg.text}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-850 text-zinc-400 hover:text-white transition active:scale-[0.98]"
            >
              Tutup
            </button>
            {isTxt && onSaveText && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-black hover:opacity-95 disabled:opacity-50 transition active:scale-[0.98]"
              >
                {saving ? "Menyimpan..." : "Simpan Perubahan Text"}
              </button>
            )}
            <a
              href={`data:application/octet-stream;base64,${fileData}`}
              download={fileName}
              className="px-5 py-2 text-xs font-semibold rounded-xl border border-zinc-850 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 transition text-center flex items-center"
            >
              Unduh Berkas
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
