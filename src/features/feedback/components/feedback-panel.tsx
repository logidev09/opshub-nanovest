"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FeedbackCategory, FeedbackModule, FeedbackStatus } from "@prisma/client";
import {
  submitSystemFeedbackAction,
  updateSystemFeedbackStatusAction,
  updateFeedbackAttachmentAction,
} from "@/features/feedback/actions/system-feedback.actions";
import { exportToCSV } from "@/features/shared/lib/export";
import { FileViewerModal } from "@/features/shared/components/file-viewer-modal";
import { MultiFileUploader } from "@/features/shared/components/multi-file-uploader";
import { parseAttachments, formatAttachmentsMessage, AttachmentItem } from "@/features/shared/lib/attachment-helper";

interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt?: string;
  submittedBy: {
    name: string | null;
    email: string;
  };
}

interface FeedbackPanelProps {
  module: FeedbackModule;
  userRole: string;
  feedbackItems: FeedbackItem[];
  isReadOnly?: boolean;
}

function formatCategory(category: FeedbackCategory) {
  return category.replaceAll("_", " ");
}

export function FeedbackPanel({ module, userRole, feedbackItems, isReadOnly = false }: FeedbackPanelProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [category, setCategory] = useState<FeedbackCategory>("UI_UX");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);

  // Active File Viewer Modal state
  const [activeViewerFile, setActiveViewerFile] = useState<{
    name: string;
    data: string;
    feedbackId: string;
    editedAt?: string | null;
  } | null>(null);

  // Multi-File Upload state
  const [attachedFiles, setAttachedFiles] = useState<AttachmentItem[]>([]);

  const handleExportFeedback = () => {
    const headers = [
      { key: "category", label: "Kategori" },
      { key: "submittedBy", label: "Pengirim" },
      { key: "message", label: "Pesan" },
      { key: "status", label: "Status" },
      { key: "createdAt", label: "Diajukan Pada" },
    ];
    const mappedData = feedbackItems.map((item) => ({
      category: formatCategory(item.category),
      submittedBy: item.submittedBy.name || item.submittedBy.email,
      message: parseAttachments(item.message).text,
      status: item.status,
      createdAt: new Date(item.createdAt).toLocaleString("id-ID"),
    }));
    exportToCSV(mappedData, headers, `Laporan_Feedback_${module}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    const finalMessage = formatAttachmentsMessage(message.trim(), attachedFiles);

    const result = await submitSystemFeedbackAction({
      module,
      category,
      message: finalMessage,
    });

    setIsSubmitting(false);
    if (!result.success) {
      setStatusMessage({
        type: "error",
        text: result.error || "Gagal mengirim feedback.",
      });
      return;
    }

    setMessage("");
    setAttachedFiles([]);
    setStatusMessage({
      type: "success",
      text: result.message || "Feedback berhasil dikirim.",
    });
    router.refresh();
  };

  const handleStatusChange = async (feedbackId: string, status: FeedbackStatus) => {
    setChangingId(feedbackId);
    setStatusMessage(null);
    const result = await updateSystemFeedbackStatusAction(feedbackId, status);
    setChangingId(null);

    if (!result.success) {
      setStatusMessage({
        type: "error",
        text: result.error || "Gagal memperbarui status feedback.",
      });
      return;
    }

    setStatusMessage({
      type: "success",
      text: result.message || "Status feedback berhasil diperbarui.",
    });
    router.refresh();
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,1.4fr]">
      <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6">
        <h3 className="text-base font-bold text-white">Feedback Manual ke Admin</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Kirim laporan bug, UI/UX, connection check, atau test case baru beserta berkas lampiran pendukung.
        </p>

        {statusMessage && (
          <div
            className={`mt-4 rounded-xl border p-3 text-xs ${
              statusMessage.type === "success"
                ? "border-emerald-500/20 bg-emerald-950/40 text-emerald-400"
                : "border-red-500/20 bg-red-950/40 text-red-400"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {isReadOnly ? (
          <div className="mt-4 rounded-xl border border-zinc-850 bg-zinc-950/40 p-6 text-center text-xs text-zinc-500 space-y-2">
            <span className="text-lg block">🔒</span>
            <p className="font-semibold text-zinc-400">Mode Lihat-Saja (Read-Only)</p>
            <p>Anda diizinkan melihat riwayat masukan ini, namun tidak memiliki hak untuk menambahkan feedback baru.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-200 outline-none focus:border-emerald-500"
              >
                {["BUG", "UI_UX", "CONNECTION", "SECURITY", "TEST_CASE", "FEATURE_REQUEST"].map((item) => (
                  <option key={item} value={item}>
                    {formatCategory(item as FeedbackCategory)}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Feedback
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Jelaskan detail feedback Anda..."
                className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500"
              />
            </div>

            {/* Multi-File Upload Field */}
            <MultiFileUploader
              files={attachedFiles}
              onChange={setAttachedFiles}
              label="Lampirkan Dokumen (Bisa Banyak Berkas: PDF, PNG, JPG, JPEG, DOCX, TXT)"
            />

            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-black transition hover:opacity-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Mengirim..." : "Kirim Feedback"}
            </button>
          </form>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 flex flex-col h-[70vh]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-bold text-white">Inbox Feedback</h3>
            <button
              type="button"
              onClick={handleExportFeedback}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-800 hover:border-emerald-500/50 bg-zinc-950 text-[10px] font-bold text-zinc-300 hover:text-white transition"
            >
              📥 Export (CSV)
            </button>
          </div>
          <span className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-400">
            {feedbackItems.length} item
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {feedbackItems.length > 0 ? (
            feedbackItems.map((item) => {
              const { text, attachments } = parseAttachments(item.message);
              return (
                <div key={item.id} className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{formatCategory(item.category)}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        Oleh: {item.submittedBy.name || item.submittedBy.email}
                      </p>
                    </div>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 self-start">
                      {item.status}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-zinc-300">{text}</p>
                  
                  {/* Multi-Attachment List in Inbox */}
                  {attachments.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="p-2 border border-zinc-900 bg-zinc-950 rounded-xl flex items-center justify-between text-xs">
                          <span className="text-zinc-400 font-mono truncate max-w-[200px]">
                            📁 {file.name}
                          </span>
                          {userRole === "ADMIN" || (session?.user?.email && item.submittedBy.email === session.user.email) ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveViewerFile({
                                  name: file.name,
                                  data: file.data,
                                  feedbackId: item.id,
                                });
                              }}
                              className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 uppercase transition cursor-pointer"
                            >
                              Lihat Berkas
                            </button>
                          ) : (
                            <span className="text-[10px] text-zinc-600 font-mono italic">
                              🔒 Rahasia
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 pt-2 border-t border-zinc-900/60 flex flex-wrap gap-x-4 gap-y-1 text-[9px] text-zinc-600 font-mono">
                    <span>Diajukan: {new Date(item.createdAt).toLocaleString("id-ID")}</span>
                    {item.status !== "OPEN" && item.updatedAt && (
                      <span className="text-emerald-500">Diproses Admin: {new Date(item.updatedAt).toLocaleString("id-ID")}</span>
                    )}
                  </div>

                  {(userRole === "ADMIN" || !isReadOnly) && (
                    <div className="mt-3 flex gap-2 pt-2 border-t border-zinc-900/40 items-center justify-between">
                      <div className="flex gap-2">
                        {(["OPEN", "IN_REVIEW", "RESOLVED"] as FeedbackStatus[]).map((status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={changingId === item.id}
                            onClick={() => handleStatusChange(item.id, status)}
                            className={`rounded-lg border px-3 py-1.5 text-[10px] font-semibold transition active:scale-95 cursor-pointer ${
                              item.status === status
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                            }`}
                          >
                            {changingId === item.id ? "Memproses..." : status}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-center text-sm text-zinc-500">
              Belum ada feedback masuk untuk modul ini.
            </div>
          )}
        </div>
      </div>

      {/* File Viewer Modal (Task 6) */}
      {activeViewerFile && (
        <FileViewerModal
          fileName={activeViewerFile.name}
          fileData={activeViewerFile.data}
          onClose={() => setActiveViewerFile(null)}
          onSaveText={async (newText) => {
            const res = await updateFeedbackAttachmentAction(activeViewerFile.feedbackId, newText);
            if (res.success && res.data) {
              setActiveViewerFile(prev => prev ? {
                ...prev,
                data: Buffer.from(newText, "utf-8").toString("base64")
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
