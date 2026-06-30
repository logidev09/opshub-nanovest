"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
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
}

interface PendingLeaveItem {
  id: string;
  type: LeaveType;
  startDate: Date | string;
  endDate: Date | string;
  reason: string | null;
  user: {
    name: string | null;
  };
}

function renderMessageText(message: UIMessage) {
  return message.parts?.map((part, index) => {
    if (part.type === "text") {
      return <span key={index}>{part.text}</span>;
    }

    return null;
  });
}

export function HrDashboardClient({
  userRole,
  initialBalance,
  initialMyLeaves,
  initialPendingLeaves,
}: HrDashboardClientProps) {
  const router = useRouter();
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
            text: "Hello! I am your Nanovest HR Copilot. I have access to company policy context and can assist you with vacation queries, salary payouts, or submit leave requests. How can I help you today?",
          },
        ],
      },
    ] as UIMessage[],
    onError: (err) => {
      try {
        const parsed = JSON.parse(err.message);
        if (parsed?.layer) {
          setChatAlert({
            title: parsed.layer === "ALLOWLIST" ? "Question Out of Scope" : "Guardrail Blocked Request",
            message: parsed.error || "Your message could not be processed.",
          });
          return;
        }
      } catch {
        // Fall through to generic service error copy.
      }

      setChatAlert({
        title: "HR Copilot Unavailable",
        message:
          err.message === "An error occurred."
            ? "The HR Copilot hit a temporary issue while generating a response. Please try again."
            : err.message || "The HR Copilot could not process your message right now.",
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
      setFormMessage({ type: "success", text: "Leave request submitted successfully!" });
      setStartDate("");
      setEndDate("");
      setReason("");
      router.refresh(); // Triggers Server Component to fetch new DB lists
    } else {
      setFormMessage({ type: "error", text: res.error || "Failed to submit leave request." });
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
      alert(res.error || "Failed to submit review.");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* LEFT COLUMN: HR Chatbot (8 Cols on LG) */}
      <div className="lg:col-span-7 flex flex-col h-[75vh] border border-zinc-900 bg-zinc-900/10 rounded-2xl overflow-hidden backdrop-blur-xl">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-zinc-900 bg-zinc-950/40 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Nanovest HR Copilot</h2>
            <p className="text-[10px] text-zinc-500 font-medium">Equipped with Vector Policy Context & 3-Lapis Guardrails</p>
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
              <h3 className="text-sm font-semibold text-white">Ask HR Copilot</h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                Ask about vacation eligibility, work hours, or salary payslips. Our guardrails prevent prompt injection automatically.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 text-sm max-w-[85%] ${
                  m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs border ${
                    m.role === "user"
                      ? "bg-emerald-500 text-black border-emerald-400"
                      : "bg-zinc-850 text-white border-zinc-700"
                  }`}
                >
                  {m.role === "user" ? "U" : "AI"}
                </div>
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
            ))
          )}

          {/* Guardrail Errors alert */}
          {chatAlert && (
            <div className="flex gap-3 max-w-[90%] mr-auto items-start">
              <div className="h-7 w-7 rounded-full bg-red-950 border border-red-500/30 flex items-center justify-center text-red-500 font-bold text-xs">
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
              <div className="h-7 w-7 rounded-full bg-zinc-850 border border-zinc-700 flex items-center justify-center text-zinc-500 text-xs">
                AI
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex gap-1.5 p-3 rounded-2xl bg-zinc-900/40 border border-zinc-900">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:0.4s]" />
                </div>
                <span className="text-[10px] text-zinc-500 font-mono animate-pulse">
                  HR Copilot is thinking...
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
              placeholder="Ask policies... (e.g. 'How many annual leave days do I get?')"
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
      <div className="lg:col-span-5 space-y-6">
        {/* Leave Balance Header Card */}
        <div className="p-6 rounded-2xl border border-zinc-900 bg-gradient-to-br from-zinc-900/60 to-zinc-950/60 shadow-xl flex items-center justify-between">
          <div>
            <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Leave Balance</h3>
            <p className="text-3xl font-extrabold text-white mt-1">
              {initialBalance} <span className="text-zinc-500 text-sm font-medium">/ 12 Days</span>
            </p>
          </div>
          <span className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg font-bold">
            🌴
          </span>
        </div>

        {/* Leave Request Form */}
        <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20">
          <h3 className="text-base font-bold text-white mb-4">Request Leave</h3>

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
                Leave Type
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-300 outline-none focus:border-emerald-500"
              >
                <option value={LeaveType.ANNUAL}>Annual Leave (Cuti Tahunan)</option>
                <option value={LeaveType.SICK}>Sick Leave (Cuti Sakit)</option>
                <option value={LeaveType.MATERNITY}>Maternity Leave (3 Months)</option>
                <option value={LeaveType.PATERNITY}>Paternity Leave (5 Days)</option>
                <option value={LeaveType.UNPAID}>Unpaid Leave (Cuti Diluar Tanggungan)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                Reason / Remarks
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for taking leave..."
                rows={2}
                className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-300 outline-none placeholder-zinc-700 focus:border-emerald-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={formLoading || !startDate || !endDate}
              className="w-full rounded-xl bg-emerald-500 py-3 text-xs font-semibold text-black hover:opacity-95 disabled:opacity-50 transition active:scale-[0.98]"
            >
              {formLoading ? "Submitting..." : "Submit Leave Request"}
            </button>
          </form>
        </div>

        {/* HR/Admin Approval Panel (Conditionally Shown) */}
        {(userRole === "ADMIN" || userRole === "HR") && initialPendingLeaves.length > 0 && (
          <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/20">
            <h3 className="text-base font-bold text-white mb-4">Pending Leave Approvals</h3>
            <div className="space-y-3 max-h-[220px] overflow-y-auto">
              {initialPendingLeaves.map((request) => (
                <div key={request.id} className="p-3 rounded-xl border border-zinc-900 bg-zinc-950/60 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white">{request.user.name}</span>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {request.type}
                    </span>
                  </div>
                  <p className="text-zinc-400 mb-2">
                    Dates: {new Date(request.startDate).toLocaleDateString()} to {new Date(request.endDate).toLocaleDateString()}
                  </p>
                  {request.reason && <p className="text-zinc-500 italic mb-3">&quot;{request.reason}&quot;</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLeaveReview(request.id, LeaveStatus.APPROVED)}
                      disabled={reviewLoading === request.id}
                      className="flex-1 bg-emerald-500 text-black py-1.5 rounded-lg font-semibold hover:opacity-90 active:scale-[0.97]"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleLeaveReview(request.id, LeaveStatus.REJECTED)}
                      disabled={reviewLoading === request.id}
                      className="flex-1 bg-zinc-800 text-zinc-300 border border-zinc-700 py-1.5 rounded-lg font-semibold hover:bg-zinc-750 active:scale-[0.97]"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Leaves List */}
        <div className="p-6 rounded-2xl border border-zinc-900 bg-zinc-900/10">
          <h3 className="text-base font-bold text-white mb-4">My Leave History</h3>
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
                        {leave.type}
                      </span>
                      <span className="text-zinc-500 mt-1 block">
                        {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
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
                No leave requests found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
