"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { useSession } from "next-auth/react";
import { submitLeaveAction, reviewLeaveAction } from "@/features/hr/actions/leave.actions";
import { LeaveStatus, LeaveType } from "@prisma/client";
import { useRouter } from "next/navigation";
import type { UIMessage } from "ai";

interface HrDashboardClientProps {
  userId: string;
  userRole: string;
  initialBalance: number;
  initialMyLeaves: LeaveHistoryItem[];
  initialPendingLeaves: PendingLeaveItem[];
}

interface ChatAlert {
  title: string;
  message: string;
}

interface LeaveHistoryItem {
  id: string;
  type: LeaveType;
  status: LeaveStatus;
  startDate: Date | string;
  endDate: Date | string;
  userName?: string | null;
  userEmail?: string | null;
}

interface PendingLeaveItem {
  id: string;
  type: LeaveType;
  startDate: Date | string;
  endDate: Date | string;
  reason: string | null;
  userId: string;
  user: {
    name: string | null;
    email: string | null;
    image?: string | null;
  };
}

function ChatAvatar({ role, image }: { role: UIMessage["role"]; image?: string | null }) {
  const isUser = role === "user";

  return (
    <div
      className={`flex h-10 w-10 min-h-10 min-w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border shadow-sm ${
        isUser
          ? "border-emerald-400/30 bg-zinc-900 text-emerald-300"
          : "border-emerald-500/20 bg-zinc-900 text-emerald-300"
      }`}
      aria-hidden="true"
    >
      {isUser ? (
        image ? (
          <img src={image} alt="User Avatar" className="h-full w-full object-cover" />
        ) : (
          <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19a3 3 0 00-6 0m6 0a3 3 0 013 3H6a3 3 0 013-3m6 0v-1a3 3 0 10-6 0v1m6-9a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        )
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.75 3.75h4.5A2.25 2.25 0 0116.5 6v1.098a3.75 3.75 0 011.84 1.214l.777.971a3.75 3.75 0 01.821 2.34V15a2.25 2.25 0 01-2.25 2.25h-.188l.602 2.108a.75.75 0 01-1.165.826L14.25 18H9.75l-2.686 2.184a.75.75 0 01-1.165-.826l.602-2.108h-.188A2.25 2.25 0 014.5 15v-3.377a3.75 3.75 0 01.821-2.34l.777-.971a3.75 3.75 0 011.84-1.214V6a2.25 2.25 0 012.25-2.25zM9 10.5h.008v.008H9V10.5zm3 0h.008v.008H12V10.5zm3 0h.008v.008H15V10.5z"
          />
        </svg>
      )}
    </div>
  );
}

function renderMessageText(message: UIMessage) {
  const renderedParts = message.parts?.map((part, index) => {
    if (part.type === "text" || part.type === "reasoning") {
      return <span key={index}>{part.text}</span>;
    }

    return null;
  }).filter(Boolean);

  if (renderedParts && renderedParts.length > 0) {
    return renderedParts;
  }

  return message.role === "assistant" ? "..." : null;
}

export function HrDashboardClient({
  userId,
  userRole,
  initialBalance,
  initialMyLeaves,
  initialPendingLeaves,
}: HrDashboardClientProps & { userId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const userName = session?.user?.name || "Employee";
  const userImage = session?.user?.image;
  const userRoleFormatted = userRole === "ADMIN" ? "Admin" : userRole === "HR" ? "HR Specialist" : "Employee";

  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const openProfileModal = async (profileUserId: string) => {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/user/${profileUserId}`);
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          setSelectedProfile(result.data);
        }
      }
    } catch (err) {
      console.error("Gagal memuat profil:", err);
    } finally {
      setProfileLoading(false);
    }
  };

  const [chatAlert, setChatAlert] = useState<ChatAlert | null>(null);
  const [input, setInput] = useState("");

  // Vercel AI SDK Chat hook
  const {
    messages,
    sendMessage,
    status,
  } = useChat({
    messages: [
      {
        id: "welcome-msg",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Halo, saya HR Copilot Nanovest. Saya dapat membantu menjawab pertanyaan seputar kebijakan perusahaan, cuti, payroll, dan pengajuan izin. Ada yang ingin Anda tanyakan?",
          },
        ],
      },
    ] as UIMessage[],
    onError: (err) => {
      try {
        const parsed = JSON.parse(err.message);
        if (parsed?.layer) {
          setChatAlert({
            title: parsed.layer === "ALLOWLIST" ? "Pertanyaan Di Luar Cakupan" : "Permintaan Diblokir Guardrail",
            message: parsed.error || "Pesan Anda tidak dapat diproses.",
          });
          return;
        }
      } catch {
        // Fall through to generic service error copy.
      }

      setChatAlert({
        title: "HR Copilot Tidak Tersedia",
        message:
          err.message === "An error occurred."
            ? "HR Copilot sedang mengalami kendala sementara saat menyiapkan respons. Silakan coba lagi."
            : err.message || "HR Copilot belum dapat memproses pesan Anda saat ini.",
      });
    },
  });

  const isChatLoading = status === "submitted" || status === "streaming";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setChatAlert(null);
    sendMessage({ text: input });
    setInput("");
  };

  // Leave Form States
  const [leaveType, setLeaveType] = useState<LeaveType>(LeaveType.ANNUAL);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);

  // Review State
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);

  // Submit new leave
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage(null);

    const res = await submitLeaveAction({
      type: leaveType,
      startDate,
      endDate,
      reason,
    });

    setFormLoading(false);
    if (res.success) {
      setFormMessage({ type: "success", text: "Pengajuan cuti berhasil dikirim." });
      setStartDate("");
      setEndDate("");
      setReason("");
      router.refresh(); // Triggers Server Component to fetch new DB lists
    } else {
      setFormMessage({ type: "error", text: res.error || "Gagal mengirim pengajuan cuti." });
    }
  };

  // Approve/Reject leave
  const handleLeaveReview = async (leaveId: string, status: LeaveStatus) => {
    setReviewLoading(leaveId);
    const res = await reviewLeaveAction(leaveId, status);
    setReviewLoading(null);

    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || "Gagal memproses persetujuan.");
    }
  };

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (pickerInput.showPicker) {
      pickerInput.showPicker();
      return;
    }
    pickerInput.focus();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
      {/* LEFT COLUMN: HR Chatbot (8 Cols on LG) */}
      <div className="lg:col-span-7 flex flex-col h-[75vh] min-w-0 border border-zinc-900 bg-zinc-900/10 rounded-2xl overflow-hidden backdrop-blur-xl">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-zinc-900 bg-zinc-950/40 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Nanovest HR Copilot</h2>
            <p className="text-[10px] text-zinc-500 font-medium">Ditenagai konteks kebijakan vektor dan guardrail berlapis</p>
          </div>
        </div>

        {/* Chat History Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-850 flex items-center justify-center text-emerald-400 mb-4 shadow-xl">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white">Tanya HR Copilot</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                Tanyakan soal jatah cuti, jam kerja, slip gaji, atau kebijakan HR lainnya. Guardrail kami melindungi percakapan dari prompt injection secara otomatis.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 text-sm max-w-[88%] ${
                  m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                <ChatAvatar role={m.role} image={m.role === "user" ? userImage : null} />
                <div className={`space-y-1 ${m.role === "user" ? "items-end text-right" : ""}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${m.role === "user" ? "text-emerald-300" : "text-zinc-500"}`}>
                    {m.role === "user" ? `${userName} (${userRoleFormatted})` : "HR Copilot"}
                  </p>
                  <div
                    className={`rounded-2xl px-4 py-3 leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                        : "bg-zinc-900/80 text-zinc-200 border border-zinc-850"
                    }`}
                  >
                    {renderMessageText(m)}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Guardrail Errors alert */}
          {chatAlert && (
            <div className="flex gap-3 max-w-[90%] mr-auto items-start">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-500/30 bg-red-950 text-red-500 font-bold text-xs">
                🛡️
              </div>
              <div className="rounded-2xl px-4 py-3 bg-red-950/30 text-red-400 border border-red-900/50 leading-relaxed text-xs">
                <span className="font-bold block mb-1">{chatAlert.title}</span>
                {chatAlert.message}
              </div>
            </div>
          )}

          {/* Loading indicators */}
          {isChatLoading && !chatAlert && (
            <div className="flex gap-3 mr-auto items-center">
              <ChatAvatar role="assistant" />
              <div className="flex gap-2 items-center">
                <div className="flex gap-1.5 p-3 rounded-2xl bg-zinc-900/40 border border-zinc-900">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0.4s]" />
                </div>
                <span className="text-[10px] text-zinc-500 font-mono animate-pulse">
                  HR Copilot sedang menyiapkan jawaban...
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input box */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-900 bg-zinc-950/30">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder={
                userRole === "HR" || userRole === "ADMIN"
                  ? "Tanyakan kebijakan atau ketik perintah (mis. 'Setujui semua cuti')"
                  : "Tanyakan kebijakan atau ajukan cuti... (mis. 'Saya ingin cuti besok karena kontrol gigi')"
              }
              className="flex-1 rounded-xl border border-zinc-850 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-emerald-500/80 transition"
            />
            <button
              type="submit"
              disabled={isChatLoading || !input.trim()}
              className="px-4 rounded-xl bg-emerald-500 text-black hover:opacity-95 disabled:opacity-50 transition active:scale-[0.98]"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9-2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT COLUMN: Leave Request Form & Leaves list (5 Cols on LG) */}
      <div className="lg:col-span-5 space-y-6 min-w-0">
        {/* Admin User Creation */}
        {userRole === "ADMIN" && (
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">Kelola Akun Admin</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Admin sekarang punya halaman khusus untuk membuat akun baru, mengubah role, reset kata sandi, dan mengaktifkan atau menonaktifkan akun.
                </p>
              </div>
              <Link
                href="/dashboard/admin"
                className="shrink-0 rounded-xl bg-zinc-100 px-4 py-2.5 text-xs font-semibold text-black transition hover:opacity-95"
              >
                Buka Admin
              </Link>
            </div>
          </div>
        )}

        {/* Leave Balance Header Card */}
        <div className="p-6 rounded-2xl border border-zinc-900 bg-gradient-to-br from-zinc-900/60 to-zinc-950/60 shadow-xl flex items-center justify-between">
          <div>
            <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Sisa Cuti</h3>
            <p className="text-3xl font-extrabold text-white mt-1">
              {initialBalance} <span className="text-zinc-500 text-sm font-medium">/ 12 Hari</span>
            </p>
          </div>
          <span className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg font-bold">
            🌴
          </span>
        </div>

        {/* Leave Request Form */}
        <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20">
          <h3 className="text-base font-bold text-white mb-4">Ajukan Cuti</h3>

          {formMessage && (
            <div
              className={`mb-4 rounded-lg p-3 text-xs font-semibold border ${
                formMessage.type === "success"
                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/20"
                  : "bg-red-950/40 text-red-400 border-red-500/20"
              }`}
            >
              {formMessage.text}
            </div>
          )}

          <form onSubmit={handleLeaveSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Jenis Cuti
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-300 outline-none focus:border-emerald-500"
              >
                <option value={LeaveType.ANNUAL}>Cuti Tahunan</option>
                <option value={LeaveType.SICK}>Cuti Sakit</option>
                <option value={LeaveType.MATERNITY}>Cuti Melahirkan (3 Bulan)</option>
                <option value={LeaveType.PATERNITY}>Cuti Ayah (5 Hari)</option>
                <option value={LeaveType.UNPAID}>Cuti Di Luar Tanggungan</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Tanggal Mulai
                </label>
                <div className="relative">
                  <input
                    ref={startDateRef}
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 outline-none focus:border-emerald-500 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Tanggal Selesai
                </label>
                <div className="relative">
                  <input
                    ref={endDateRef}
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 outline-none focus:border-emerald-500 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Alasan / Catatan
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Tuliskan alasan pengajuan cuti..."
                rows={2}
                className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-300 outline-none placeholder-zinc-700 focus:border-emerald-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={formLoading || !startDate || !endDate}
              className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-semibold text-black hover:opacity-95 disabled:opacity-50 transition active:scale-[0.98]"
            >
              {formLoading ? "Mengirim..." : "Kirim Pengajuan Cuti"}
            </button>
            {userRole === "HR" || userRole === "ADMIN" ? (
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Sebagai HR/Admin, Anda dapat memantau, menyetujui, dan menolak cuti karyawan langsung dari panel di bawah ini atau melalui perintah chatbot (misal: <span className="text-zinc-300">&quot;setujui semua pengajuan cuti&quot;</span>).
              </p>
            ) : (
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Anda juga bisa mengetik di chat seperti <span className="text-zinc-300">&quot;Saya ingin cuti besok karena kontrol gigi&quot;</span> dan sistem akan otomatis membuat pengajuan jika tanggalnya terbaca.
              </p>
            )}
          </form>
        </div>

        {/* HR/Admin Approval Panel (Conditionally Shown) */}
        {(userRole === "ADMIN" || userRole === "HR") && initialPendingLeaves.length > 0 && (
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20">
            <h3 className="text-base font-bold text-white mb-4">Persetujuan Cuti Tertunda</h3>
            <div className="space-y-3 max-h-[220px] overflow-y-auto">
              {initialPendingLeaves.map((request) => (
                <div key={request.id} className="p-3 rounded-xl border border-zinc-900 bg-zinc-950/60 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={() => openProfileModal(request.userId)}
                      className="flex items-center gap-2 font-bold text-emerald-400 hover:text-emerald-300 transition hover:underline cursor-pointer text-left"
                      title="Lihat Detail Profil Karyawan"
                    >
                      <span className="h-6 w-6 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-400 shrink-0 no-underline">
                        {request.user.image ? <img src={request.user.image} alt={request.user.name || "Avatar"} className="h-full w-full object-cover" /> : request.user.name?.[0]?.toUpperCase()}
                      </span>
                      {request.user.name}
                    </button>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {request.type}
                    </span>
                  </div>
                  <p className="text-zinc-400 mb-2">
                    Tanggal: {new Date(request.startDate).toLocaleDateString("id-ID")} sampai {new Date(request.endDate).toLocaleDateString("id-ID")}
                  </p>
                  {request.reason && <p className="text-zinc-500 italic mb-3">&quot;{request.reason}&quot;</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLeaveReview(request.id, LeaveStatus.APPROVED)}
                      disabled={reviewLoading === request.id}
                      className="flex-1 bg-emerald-500 text-black py-1.5 rounded-lg font-semibold hover:opacity-90 active:scale-[0.97]"
                    >
                      Setujui
                    </button>
                    <button
                      onClick={() => handleLeaveReview(request.id, LeaveStatus.REJECTED)}
                      disabled={reviewLoading === request.id}
                      className="flex-1 bg-zinc-800 text-zinc-300 border border-zinc-700 py-1.5 rounded-lg font-semibold hover:bg-zinc-750 active:scale-[0.97]"
                    >
                      Tolak
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Leaves List / All Leaves List */}
        <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/10">
          <h3 className="text-base font-bold text-white mb-4">
            {userRole === "HR" || userRole === "ADMIN" ? "Riwayat Cuti Seluruh Karyawan" : "Riwayat Cuti Saya"}
          </h3>
          <div className="space-y-3 max-h-[250px] overflow-y-auto">
            {initialMyLeaves.length > 0 ? (
              initialMyLeaves.map((leave) => {
                let badgeClass = "text-zinc-400 bg-zinc-900 border-zinc-800";
                if (leave.status === LeaveStatus.APPROVED) badgeClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                if (leave.status === LeaveStatus.REJECTED) badgeClass = "text-red-400 bg-red-500/10 border-red-500/20";

                return (
                  <div
                    key={leave.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-zinc-900 bg-zinc-950/40 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-white block uppercase tracking-wide text-[10px]">
                        {leave.type} {leave.userName ? `· ${leave.userName}` : ""}
                      </span>
                      <span className="text-zinc-500 mt-1 block">
                        {new Date(leave.startDate).toLocaleDateString("id-ID")} - {new Date(leave.endDate).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full font-semibold border ${badgeClass}`}>
                      {leave.status}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-zinc-500 text-xs">
                Belum ada riwayat pengajuan cuti.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Detail Modal (Task 4) */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl max-w-sm w-full space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider text-zinc-400">Profil Karyawan</h3>
              <button
                onClick={() => setSelectedProfile(null)}
                className="text-zinc-400 hover:text-white transition"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-zinc-850 border border-zinc-700 flex items-center justify-center text-zinc-300 font-bold overflow-hidden">
                {selectedProfile.image ? (
                  <img src={selectedProfile.image} alt={selectedProfile.name} className="h-full w-full object-cover" />
                ) : (
                  selectedProfile.name?.[0]?.toUpperCase() || "U"
                )}
              </div>
              <div className="text-left">
                <h4 className="text-sm font-bold text-white">{selectedProfile.name}</h4>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">
                  {selectedProfile.role} · {selectedProfile.division || "Divisi Belum Diatur"}
                </p>
              </div>
            </div>
            <div className="space-y-2 text-xs border-t border-zinc-800 pt-3 text-left">
              <div>
                <span className="text-zinc-500 block text-[9px] uppercase font-bold tracking-wide">Email</span>
                <span className="text-zinc-300 font-medium">{selectedProfile.email}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[9px] uppercase font-bold tracking-wide">Nomor HP</span>
                <span className="text-zinc-300 font-medium">{selectedProfile.phone || "-"}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[9px] uppercase font-bold tracking-wide">Tentang Karyawan</span>
                <p className="text-zinc-400 mt-0.5 leading-relaxed italic">{selectedProfile.bio || "Tidak ada biodata."}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
