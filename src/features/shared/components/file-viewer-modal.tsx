"use client";

import { useState, useEffect } from "react";

interface FileViewerModalProps {
  fileName: string;
  fileData: string; // base64 string
  editedAt?: string | null;
  readOnly?: boolean;
  onClose: () => void;
  onSaveText?: (newText: string) => Promise<{ success: boolean; error?: string }>;
}

export function FileViewerModal({
  fileName,
  fileData,
  editedAt,
  readOnly = false,
  onClose,
  onSaveText,
}: FileViewerModalProps) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
  const isPdf = ext === "pdf";
  const isTxt = ext === "txt" || ext === "log" || ext === "json";

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Generate Blob URL for PDF to guarantee online browser rendering
  useEffect(() => {
    if (isPdf && fileData) {
      try {
        const byteCharacters = atob(fileData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
        return () => URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Gagal membuat blob URL untuk PDF:", e);
      }
    }
  }, [fileData, isPdf]);

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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl max-w-4xl w-full flex flex-col h-[90vh] sm:h-[85vh] overflow-hidden relative z-[101]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">📄</span>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">File Online Viewer</h3>
              <span className="text-[10px] text-zinc-400 font-mono mt-0.5 block truncate max-w-xs sm:max-w-md">{fileName}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition flex items-center justify-center font-bold text-base cursor-pointer shrink-0 z-[102]"
            title="Tutup Modal"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-950/40 text-xs">
          {isImage && (
            <div className="flex justify-center items-center py-2 bg-zinc-950/80 rounded-xl border border-zinc-850 p-2 min-h-[300px]">
              <img
                src={`data:image/${ext === "jpg" ? "jpeg" : ext};base64,${fileData}`}
                alt={fileName}
                className="max-h-[50vh] sm:max-h-[60vh] max-w-full object-contain rounded-lg shadow-xl"
              />
            </div>
          )}

          {isPdf && (
            <div className="flex-1 w-full min-h-[50vh] h-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex flex-col relative">
              {pdfBlobUrl ? (
                <object
                  data={pdfBlobUrl}
                  type="application/pdf"
                  className="w-full h-full border-0 rounded-xl"
                >
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-3 p-6 text-center">
                    <span className="text-3xl">📄</span>
                    <p className="text-sm font-semibold text-zinc-200">PDF Tidak Dapat Ditampilkan</p>
                    <p className="text-xs">Browser Anda mungkin tidak mendukung pratinjau PDF bawaan.</p>
                    <a href={`data:application/octet-stream;base64,${fileData}`} download={fileName} className="px-4 py-2 mt-2 text-xs font-semibold rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 transition">
                      Unduh PDF
                    </a>
                  </div>
                </object>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <p className="text-xs">Membuka dokumen PDF secara online...</p>
                </div>
              )}
            </div>
          )}

          {isTxt && (
            <div className="flex flex-col h-[50vh] space-y-3">
              <div className="flex justify-between items-center text-[10px] text-zinc-400">
                <span>{readOnly ? "File teks (Read-Only):" : "Ekstensi file teks dapat langsung disunting:"}</span>
                {editedAt && (
                  <span className="text-emerald-400 font-semibold">
                    Terakhir diubah: {new Date(editedAt).toLocaleString("id-ID")}
                  </span>
                )}
              </div>
              <textarea
                value={textVal}
                readOnly={readOnly}
                onChange={(e) => setTextVal(e.target.value)}
                className={`flex-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs font-mono text-zinc-200 outline-none focus:border-emerald-500/80 resize-none leading-relaxed ${readOnly ? "cursor-not-allowed text-zinc-500" : ""}`}
              />
            </div>
          )}

          {!isImage && !isPdf && !isTxt && (
            <div className="py-12 text-center space-y-3">
              <span className="text-4xl block">📁</span>
              <p className="text-zinc-300">Berkas bertipe <strong>.{ext.toUpperCase()}</strong> tidak dapat dipratinjau langsung.</p>
              <p className="text-zinc-500 text-[10px]">Silakan klik tombol download di bawah untuk membacanya di perangkat Anda.</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-zinc-950/80 border-t border-zinc-800 flex items-center justify-between shrink-0">
          <div className="text-xs">
            {msg && (
              <span className={msg.type === "success" ? "text-emerald-400 font-semibold" : "text-red-400"}>
                {msg.text}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-800 text-zinc-300 hover:text-white transition active:scale-[0.98] cursor-pointer"
            >
              Tutup
            </button>
            {isTxt && onSaveText && !readOnly && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-50 transition active:scale-[0.98] cursor-pointer"
              >
                {saving ? "Menyimpan..." : "Simpan Perubahan Text"}
              </button>
            )}
            <a
              href={`data:application/octet-stream;base64,${fileData}`}
              download={fileName}
              className="px-5 py-2 text-xs font-semibold rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 transition text-center flex items-center gap-1.5"
            >
              📥 Unduh Berkas
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
