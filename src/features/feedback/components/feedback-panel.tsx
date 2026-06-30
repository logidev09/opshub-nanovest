"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackCategory, FeedbackModule, FeedbackStatus } from "@prisma/client";
import {
  submitSystemFeedbackAction,
  updateSystemFeedbackStatusAction,
} from "@/features/feedback/actions/system-feedback.actions";

interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
  submittedBy: {
    name: string | null;
    email: string;
  };
}

interface FeedbackPanelProps {
  module: FeedbackModule;
  userRole: string;
  feedbackItems: FeedbackItem[];
}

function formatCategory(category: FeedbackCategory) {
  return category.replaceAll("_", " ");
}

export function FeedbackPanel({ module, userRole, feedbackItems }: FeedbackPanelProps) {
  const router = useRouter();
  const [category, setCategory] = useState<FeedbackCategory>("UI_UX");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    const result = await submitSystemFeedbackAction({
      module,
      category,
      message,
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
          Employee, HR, atau admin dapat mengirim feedback UI/UX, test connection, bug, dan test case manual untuk modul ini.
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
              placeholder="Contoh: tambahkan test login invalid, cek koneksi database, dan perbaiki alignment komponen."
              className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !message.trim()}
            className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-black transition hover:opacity-95 disabled:opacity-50"
          >
            {isSubmitting ? "Mengirim..." : "Kirim Feedback"}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Inbox Feedback</h3>
          <span className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-400">
            {feedbackItems.length} item
          </span>
        </div>

        <div className="space-y-3">
          {feedbackItems.length > 0 ? (
            feedbackItems.map((item) => (
              <div key={item.id} className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{formatCategory(item.category)}</p>
                    <p className="text-[11px] text-zinc-500">
                      {item.submittedBy.name || item.submittedBy.email} •{" "}
                      {new Date(item.createdAt).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400">
                    {item.status}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-zinc-300">{item.message}</p>
                {userRole === "ADMIN" && (
                  <div className="mt-3 flex gap-2">
                    {(["OPEN", "IN_REVIEW", "RESOLVED"] as FeedbackStatus[]).map((status) => (
                      <button
                        key={status}
                        type="button"
                        disabled={changingId === item.id}
                        onClick={() => handleStatusChange(item.id, status)}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
                      >
                        {changingId === item.id ? "Memproses..." : status}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 p-6 text-center text-sm text-zinc-500">
              Belum ada feedback masuk untuk modul ini.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
