"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { useSession } from "next-auth/react";
import { submitLeaveAction, reviewLeaveAction, cancelLeaveAction, updateLeaveAttachmentAction } from "@/features/hr/actions/leave.actions";
import { LeaveStatus, LeaveType } from "@prisma/client";
import { useRouter } from "next/navigation";
import type { UIMessage } from "ai";
import { exportToCSV } from "@/features/shared/lib/export";
import { FileViewerModal } from "@/features/shared/components/file-viewer-modal";

interface HrDashboardClientProps {
  userId: string;
  userRole: string;
  initialBalance: number;
  initialMyLeaves: LeaveHistoryItem[];
  initialPendingLeaves: PendingLeaveItem[];
  initialEmployees?: any[];
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
  userId?: string;
  createdAt: Date | string;
  approvedAt?: Date | string | null;
  metadata?: any;
}

interface PendingLeaveItem {
  id: string;
  type: LeaveType;
  startDate: Date | string;
  endDate: Date | string;
  reason: string | null;
  userId: string;
  createdAt: Date | string;
  approvedAt?: Date | string | null;
  metadata?: any;
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
  initialEmployees = [],
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

  const openStartDatePicker = () => {
    if (startDateRef.current) {
      if (typeof startDateRef.current.showPicker === "function") {
        startDateRef.current.showPicker();
      } else {
        startDateRef.current.focus();
      }
    }
  };

  const openEndDatePicker = () => {
    if (endDateRef.current) {
      if (typeof endDateRef.current.showPicker === "function") {
        endDateRef.current.showPicker();
      } else {
        endDateRef.current.focus();
      }
    }
  };

  // File Upload states for Leave request
  const [fileName, setFileName] = useState("");
  const [fileBase64, setFileBase64] = useState("");
  const [readingFile, setReadingFile] = useState(false);

  // Active File Viewer Modal state
  const [activeViewerFile, setActiveViewerFile] = useState<{
    name: string;
    data: string;
    leaveId?: string;
    editedAt?: string | null;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setFileName(file.name);
      setFileBase64(base64);
      setReadingFile(false);
    };
    reader.onerror = () => {
      alert("Gagal membaca berkas.");
      setReadingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleExportCuti = () => {
    const headers = [
      { key: "userName", label: "Nama Karyawan" },
      { key: "type", label: "Jenis Cuti" },
      { key: "status", label: "Status" },
      { key: "startDate", label: "Tanggal Mulai" },
      { key: "endDate", label: "Tanggal Selesai" },
      { key: "createdAt", label: "Diajukan Pada" },
      { key: "approvedAt", label: "Diproses Pada" },
    ];
    // Map dates to localized readable strings for CSV
    const mappedData = initialMyLeaves.map(l => ({
      ...l,
      startDate: new Date(l.startDate).toLocaleDateString("id-ID"),
      endDate: new Date(l.endDate).toLocaleDateString("id-ID"),
      createdAt: new Date(l.createdAt).toLocaleString("id-ID"),
      approvedAt: l.approvedAt ? new Date(l.approvedAt).toLocaleString("id-ID") : "-",
    }));
    exportToCSV(mappedData, headers, "Laporan_Cuti_Karyawan");
  };

  const handleExportKaryawan = () => {
    const headers = [
      { key: "name", label: "Nama Lengkap" },
      { key: "email", label: "Alamat Email" },
      { key: "division", label: "Divisi" },
      { key: "role", label: "Wewenang (Role)" },
      { key: "phone", label: "Nomor HP" },
      { key: "isActive", label: "Status Aktif" },
      { key: "createdAt", label: "Terdaftar Sejak" },
    ];
    const mappedData = initialEmployees.map(emp => ({
      ...emp,
      isActive: emp.isActive ? "Aktif" : "Nonaktif",
      createdAt: new Date(emp.createdAt).toLocaleDateString("id-ID"),
    }));
    exportToCSV(mappedData, headers, "Data_Karyawan_Nanovest");
  };

  // Review State
  const [reviewLoading, setReviewLoading] = useState<string | null>(null);

  // Right Sidepanel states (Task 1)
  const [activeRightTab, setActiveRightTab] = useState<"chat" | "leaves">("chat");
  const [isMobileSidePanelOpen, setIsMobileSidePanelOpen] = useState(false);

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
      attachmentName: fileName || undefined,
      attachmentData: fileBase64 || undefined,
    });

    setFormLoading(false);
    if (res.success) {
      setFormMessage({ type: "success", text: "Pengajuan cuti berhasil dikirim." });
      setStartDate("");
      setEndDate("");
      setReason("");
      setFileName("");
      setFileBase64("");
      setIsMobileSidePanelOpen(true);
      setActiveRightTab("leaves");
      router.refresh();
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

  const [cancelLoading, setCancelLoading] = useState<string | null>(null);

  const handleLeaveCancel = async (leaveId: string) => {
    if (!confirm("Apakah Anda yakin ingin membatalkan pengajuan cuti ini?")) return;
    setCancelLoading(leaveId);
    const res = await cancelLeaveAction(leaveId);
    setCancelLoading(null);

    if (res.success) {
      router.refresh();
    } else {
      alert(res.error || "Gagal membatalkan pengajuan cuti.");
    }
  };

  // Floating Chat states
  const [isFloatingChatOpen, setIsFloatingChatOpen] = useState(false);
  const [floatingChatInput, setFloatingChatInput] = useState("");
  const [floatingChatMessages, setFloatingChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    {
      role: "assistant",
      text: "Halo! Saya HR Floating Assistant. Ada yang bisa saya bantu terkait kebijakan cuti, data RAG dokumen, atau status pengajuan cuti Anda?",
    },
  ]);
  const [floatingChatLoading, setFloatingChatLoading] = useState(false);

  const handleFloatingChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!floatingChatInput.trim() || floatingChatLoading) return;

    const userText = floatingChatInput.trim();
    setFloatingChatInput("");
    setFloatingChatMessages((prev) => [...prev, { role: "user", text: userText }]);
    setFloatingChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...floatingChatMessages.map((m) => ({
              role: m.role,
              content: m.text,
            })),
            { role: "user", content: userText },
          ],
        }),
      });

      if (res.ok) {
        const text = await res.text();
        let cleanedResponse = text;

        if (text.includes('{"type":"text-delta"')) {
          try {
            const matches = text.match(/"delta":"(.*?)"/g);
            if (matches) {
              cleanedResponse = matches
                .map((m) => m.replace(/"delta":"/, "").replace(/"$/, ""))
                .join("")
                .replace(/\\n/g, "\n");
            }
          } catch {}
        } else if (text.startsWith("0:")) {
          cleanedResponse = text
            .split("\n")
            .filter((line) => line.startsWith("0:"))
            .map((line) => line.slice(2).replace(/"/g, ""))
            .join("");
        }

        setFloatingChatMessages((prev) => [
          ...prev,
          { role: "assistant", text: cleanedResponse.replace(/\\n/g, "\n").trim() },
        ]);
      } else {
        setFloatingChatMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Terjadi kesalahan menghubungi HR Copilot." },
        ]);
      }
    } catch {
      setFloatingChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Terjadi kesalahan koneksi internet." },
      ]);
    } finally {
      setFloatingChatLoading(false);
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
    <div className="flex flex-col lg:flex-row gap-8 items-start w-full relative">
      {/* Floating Action Button in Bottom Right Corner (Mobile/Tablet View - Task 1) */}
      <div
        style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 99999 }}
        className="lg:hidden flex flex-col items-end"
      >
        <button
          type="button"
          onClick={() => setIsMobileSidePanelOpen(!isMobileSidePanelOpen)}
          className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-2xl transition active:scale-95 shadow-2xl flex items-center justify-center border border-emerald-300/50 cursor-pointer"
        >
          {isMobileSidePanelOpen ? "✕" : "💬"}
        </button>
      </div>

      {/* Backdrop overlay for mobile drawer */}
      {isMobileSidePanelOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99998 }}
          className="bg-black/85 lg:hidden"
          onClick={() => setIsMobileSidePanelOpen(false)}
        />
      )}

      {/* LEFT COLUMN: Main Form & Dashboard Controls */}
      <div className="w-full lg:flex-1 space-y-6 min-w-0">
        {/* Admin User Creation */}
        {userRole === "ADMIN" && (
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">Kelola Akun Admin</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Admin dapat membuat akun baru, mengubah role, reset kata sandi, dan menyetujui akun baru.
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
            <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Jatah Sisa Cuti</h3>
            <p className="text-3xl font-extrabold text-white mt-1">
              {initialBalance} <span className="text-zinc-500 text-sm font-medium">/ 12 Hari</span>
            </p>
            <span className="text-[10px] text-emerald-400 mt-1 block font-medium">
              {Math.round((initialBalance / 12) * 100)}% Jatah Cuti Tersedia
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 flex items-center justify-center">
              <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
                <path
                  className="text-zinc-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500 transition-all duration-1000"
                  strokeWidth="3.5"
                  strokeDasharray={`${(initialBalance / 12) * 100}, 100`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[11px] font-extrabold text-white font-mono">
                {Math.round((initialBalance / 12) * 100)}%
              </span>
            </div>
            <span className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg font-bold shadow-inner shrink-0">
              🌴
            </span>
          </div>
        </div>

        {/* Leave Request Form */}
        <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-xl">
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
                <div className="relative flex items-center">
                  <input
                    ref={startDateRef}
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-850 bg-zinc-950 pl-3 pr-10 py-2 text-xs text-zinc-300 outline-none focus:border-emerald-500 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
                  />
                  <button
                    type="button"
                    onClick={openStartDatePicker}
                    className="absolute right-3 text-zinc-500 hover:text-white transition cursor-pointer text-xs"
                    title="Pilih Tanggal Mulai"
                  >
                    📅
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Tanggal Selesai
                </label>
                <div className="relative flex items-center">
                  <input
                    ref={endDateRef}
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-850 bg-zinc-950 pl-3 pr-10 py-2 text-xs text-zinc-300 outline-none focus:border-emerald-500 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
                  />
                  <button
                    type="button"
                    onClick={openEndDatePicker}
                    className="absolute right-3 text-zinc-500 hover:text-white transition cursor-pointer text-xs"
                    title="Pilih Tanggal Selesai"
                  >
                    📅
                  </button>
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

            {/* Optional attachment upload */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Dokumen Tambahan (PDF, PNG, JPEG, JPG, DOCX - Opsional)
              </label>
              <div className="relative flex items-center justify-between border border-zinc-850 rounded-xl bg-zinc-950 px-3.5 py-2 text-xs">
                <input
                  type="file"
                  accept=".pdf,.png,.jpeg,.jpg,.docx"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  disabled={readingFile}
                />
                <span className="text-zinc-400 truncate max-w-[200px]">
                  {fileName || "Pilih dokumen..."}
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
              disabled={formLoading || readingFile || !startDate || !endDate}
              className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-semibold text-black hover:opacity-95 disabled:opacity-50 transition active:scale-[0.98]"
            >
              {formLoading ? "Mengirim..." : "Kirim Pengajuan Cuti"}
            </button>
            {userRole === "HR" || userRole === "ADMIN" ? (
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Sebagai HR/Admin, Anda dapat memantau, menyetujui, dan menolak cuti karyawan dari panel persetujuan atau via chatbot.
              </p>
            ) : (
              <p className="text-[11px] leading-relaxed text-zinc-500">
                Anda juga bisa mengetik di AI Chat side panel seperti <span className="text-zinc-300">&quot;Saya ingin cuti besok karena kontrol gigi&quot;</span>.
              </p>
            )}
          </form>
        </div>

        {/* HR/Admin Approval Panel */}
        {(userRole === "ADMIN" || userRole === "HR") && initialPendingLeaves.length > 0 && (
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-xl">
            <h3 className="text-base font-bold text-white mb-4">Persetujuan Cuti Tertunda</h3>
            <div className="space-y-3 max-h-[260px] overflow-y-auto">
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
                  {request.reason && <p className="text-zinc-500 italic mb-2">&quot;{request.reason}&quot;</p>}
                  {(() => {
                    const meta = request.metadata as any;
                    const hasAttach = meta && meta.attachmentName && meta.attachmentData;
                    if (!hasAttach) return null;
                    return (
                      <div className="mb-3 p-1.5 rounded border border-zinc-900 bg-zinc-950/40 flex items-center justify-between gap-3">
                        <span className="font-mono text-[9px] text-zinc-500 truncate max-w-[130px]">
                          📁 {meta.attachmentName}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveViewerFile({
                              name: meta.attachmentName,
                              data: meta.attachmentData,
                              leaveId: request.id,
                              editedAt: meta.editedAt || null,
                            });
                          }}
                          className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 uppercase shrink-0"
                        >
                          Lihat Berkas
                        </button>
                      </div>
                    );
                  })()}
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
      </div>

        {/* Leave History List Card (Moved to main page) */}
        <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20 backdrop-blur-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-900 pb-3">
            <h3 className="text-base font-bold text-white">
              {userRole === "HR" || userRole === "ADMIN" ? "Riwayat Cuti Seluruh Karyawan" : "Riwayat Cuti Saya"}
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExportCuti}
                className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-emerald-500/50 bg-zinc-950 text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer"
              >
                📥 Cuti (CSV)
              </button>
              {(userRole === "HR" || userRole === "ADMIN") && (
                <button
                  type="button"
                  onClick={handleExportKaryawan}
                  className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-emerald-500/50 bg-zinc-950 text-xs font-bold text-zinc-300 hover:text-white transition cursor-pointer"
                >
                  📥 Karyawan (CSV)
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-900 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <th className="pb-3 px-2">Nama & Jenis</th>
                  <th className="pb-3 px-2">Tanggal Cuti</th>
                  <th className="pb-3 px-2">Diajukan Pada</th>
                  <th className="pb-3 px-2">Diproses Pada</th>
                  <th className="pb-3 px-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/40">
                {initialMyLeaves.length > 0 ? (
                  initialMyLeaves.map((leave) => {
                    let badgeClass = "text-zinc-400 bg-zinc-900 border-zinc-800";
                    if (leave.status === LeaveStatus.APPROVED) badgeClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                    if (leave.status === LeaveStatus.REJECTED) badgeClass = "text-red-400 bg-red-500/10 border-red-500/20";

                    const meta = leave.metadata as any;
                    const hasAttach = meta && meta.attachmentName && meta.attachmentData;

                    return (
                      <tr key={leave.id} className="hover:bg-zinc-900/30 transition">
                        <td className="py-3 px-2">
                          <span className="font-bold text-white block">
                            {leave.userName || userName}
                          </span>
                          <span className="text-[10px] text-emerald-400 uppercase font-semibold">
                            {leave.type}
                          </span>
                          {hasAttach && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveViewerFile({
                                  name: meta.attachmentName,
                                  data: meta.attachmentData,
                                  leaveId: leave.id,
                                  editedAt: meta.editedAt || null,
                                });
                              }}
                              className="text-[9px] text-zinc-400 hover:text-emerald-300 underline block mt-0.5 cursor-pointer"
                            >
                              📁 {meta.attachmentName}
                            </button>
                          )}
                        </td>
                        <td className="py-3 px-2 text-zinc-300 font-mono text-[11px]">
                          {new Date(leave.startDate).toLocaleDateString("id-ID")} - {new Date(leave.endDate).toLocaleDateString("id-ID")}
                        </td>
                        <td className="py-3 px-2 text-zinc-500 text-[11px]">
                          {new Date(leave.createdAt).toLocaleDateString("id-ID")}
                        </td>
                        <td className="py-3 px-2 text-zinc-500 text-[11px]">
                          {leave.approvedAt ? new Date(leave.approvedAt).toLocaleDateString("id-ID") : "-"}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className={`px-2 py-0.5 rounded-full font-semibold border text-[9px] ${badgeClass}`}>
                              {leave.status}
                            </span>
                            {userRole === "ADMIN" && (
                              <div className="flex gap-1 mt-0.5">
                                {leave.status !== LeaveStatus.APPROVED && (
                                  <button
                                    onClick={() => handleLeaveReview(leave.id, LeaveStatus.APPROVED)}
                                    disabled={reviewLoading === leave.id}
                                    className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 uppercase disabled:opacity-50 cursor-pointer"
                                  >
                                    Setujui
                                  </button>
                                )}
                                {leave.status !== LeaveStatus.REJECTED && (
                                  <button
                                    onClick={() => handleLeaveReview(leave.id, LeaveStatus.REJECTED)}
                                    disabled={reviewLoading === leave.id}
                                    className="text-[9px] font-bold text-red-400 hover:text-red-300 uppercase disabled:opacity-50 ml-1 cursor-pointer"
                                  >
                                    Tolak
                                  </button>
                                )}
                              </div>
                            )}
                            {leave.userId === userId && leave.status === LeaveStatus.PENDING && (
                              <button
                                onClick={() => handleLeaveCancel(leave.id)}
                                disabled={cancelLoading === leave.id}
                                className="text-[9px] font-bold text-amber-500 hover:text-amber-400 uppercase disabled:opacity-50 cursor-pointer"
                              >
                                Batalkan
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-zinc-500 text-xs">
                      Belum ada riwayat pengajuan cuti.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      {/* Floating Action Button (Live Chat Bubble at Bottom-Right) */}
      <div
        style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 99999 }}
        className="flex flex-col items-end"
      >
        <button
          type="button"
          onClick={() => setIsMobileSidePanelOpen(!isMobileSidePanelOpen)}
          className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-2xl shadow-2xl flex items-center justify-center border border-emerald-300/50 cursor-pointer active:scale-95 transition"
          title="Buka AI Copilot Chat"
        >
          {isMobileSidePanelOpen ? "✕" : "💬"}
        </button>
      </div>

      {/* Floating AI Chatbot Mini Window */}
      {isMobileSidePanelOpen && (
        <div
          style={{ position: "fixed", bottom: "90px", right: "24px", zIndex: 99998 }}
          className="w-[calc(100vw-32px)] sm:w-[400px] h-[520px] max-h-[80vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Nanovest HR Copilot AI</span>
            </div>
            <div className="flex items-center gap-2">
              {(userRole === "HR" || userRole === "ADMIN") && (
                <Link
                  href="/dashboard/hr/policies"
                  className="text-[10px] font-bold text-emerald-400 hover:underline"
                >
                  📁 Dokumen RAG
                </Link>
              )}
              <button
                type="button"
                onClick={() => setIsMobileSidePanelOpen(false)}
                className="text-zinc-400 hover:text-white text-base font-bold transition ml-2 cursor-pointer"
                title="Tutup Chat"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-800">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="h-10 w-10 rounded-2xl bg-zinc-900 border border-zinc-850 flex items-center justify-center text-emerald-400 mb-3 shadow-xl">
                  💬
                </div>
                <h3 className="text-xs font-semibold text-white">Tanya HR Copilot</h3>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-xs leading-relaxed">
                  Tanyakan kebijakan jatah cuti, aturan HR, atau ketik langsung pengajuan cuti Anda.
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2.5 text-xs max-w-[90%] ${
                    m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  }`}
                >
                  <ChatAvatar role={m.role} image={m.role === "user" ? userImage : null} />
                  <div className={`space-y-1 ${m.role === "user" ? "items-end text-right" : ""}`}>
                    <p className={`text-[9px] font-semibold uppercase tracking-wider ${m.role === "user" ? "text-emerald-300" : "text-zinc-500"}`}>
                      {m.role === "user" ? `${userName}` : "HR Copilot"}
                    </p>
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap ${
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

            {chatAlert && (
              <div className="flex gap-2.5 max-w-[92%] mr-auto items-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-500/30 bg-red-950 text-red-500 font-bold text-xs">
                  🛡️
                </div>
                <div className="rounded-2xl px-3.5 py-2.5 bg-red-950/30 text-red-400 border border-red-900/50 leading-relaxed text-xs">
                  <span className="font-bold block mb-1">{chatAlert.title}</span>
                  {chatAlert.message}
                </div>
              </div>
            )}

            {isChatLoading && !chatAlert && (
              <div className="flex gap-2 mr-auto items-center">
                <ChatAvatar role="assistant" />
                <div className="flex gap-1.5 p-2.5 rounded-2xl bg-zinc-900/40 border border-zinc-900">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          {/* Input Box */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-900 bg-zinc-950 shrink-0">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder="Ketik pertanyaan atau ajukan cuti..."
                className="flex-1 rounded-xl border border-zinc-850 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none focus:border-emerald-500 transition"
              />
              <button
                type="submit"
                disabled={isChatLoading || !input.trim()}
                className="px-3.5 rounded-xl bg-emerald-500 text-black hover:opacity-95 disabled:opacity-50 transition active:scale-[0.98] text-xs font-bold cursor-pointer"
              >
                Kirim
              </button>
            </div>
          </form>
        </div>
      )}

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

      {/* File Viewer Modal (Task 6) */}
      {activeViewerFile && (
        <FileViewerModal
          fileName={activeViewerFile.name}
          fileData={activeViewerFile.data}
          editedAt={activeViewerFile.editedAt}
          onClose={() => setActiveViewerFile(null)}
          onSaveText={async (newText) => {
            const res = await updateLeaveAttachmentAction(activeViewerFile.leaveId!, newText);
            if (res.success && res.data) {
              setActiveViewerFile(prev => prev ? {
                ...prev,
                data: Buffer.from(newText, "utf-8").toString("base64"),
                editedAt: (res.data as any).metadata.editedAt
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
