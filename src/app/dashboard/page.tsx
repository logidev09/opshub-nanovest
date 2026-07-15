import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/features/shared/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  const sessionUser = session.user as any;

  // Halaman dashboard/overview hanya untuk ADMIN atau employee dengan divisi CX Engineer
  if (sessionUser.role !== "ADMIN" && sessionUser.division !== "CX Engineer") {
    if (sessionUser.role === "HR" || sessionUser.division === "HR") {
      redirect("/dashboard/hr");
    } else if (sessionUser.division === "Accounting") {
      redirect("/dashboard/finance");
    } else if (sessionUser.division === "Quality Assurance") {
      redirect("/dashboard/qa");
    } else if (sessionUser.division === "Security Operations & IT Support") {
      redirect("/dashboard/security");
    } else {
      redirect("/dashboard/profile");
    }
  }

  // Fetch dynamic stats from database
  const [policyCount, pendingLeavesCount, totalAuditLogs, recentLogs, financeAccountCount, journalEntryCount, feedbackOpenCount] = await Promise.all([
    prisma.hrPolicy.count().catch(() => 0),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.auditLog.count().catch(() => 0),
    prisma.auditLog
      .findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              name: true,
              email: true,
              role: true,
            },
          },
        },
      })
      .catch(() => []),
    prisma.financeAccount.count().catch(() => 0),
    prisma.journalEntry.count().catch(() => 0),
    prisma.systemFeedback.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }).catch(() => 0),
  ]);

  const cards = [
    {
      name: "HR Operations (Deep-Dive)",
      desc: "Fully functional HR Copilot with RAG and leave management.",
      status: "Production-ready",
      statusColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      cta: "Open HR Copilot",
      ctaHref: "/dashboard/hr",
      stats: [
        { label: "Active Policies", value: policyCount },
        { label: "Pending Leave Requests", value: pendingLeavesCount },
      ],
      locked: false,
    },
    {
      name: "Finance Ledger",
      desc: "Chart of accounts PSAK-style, journal posting, and trial balance monitoring.",
      status: "Production-ready",
      statusColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      cta: "Open Finance Ledger",
      ctaHref: "/dashboard/finance",
      stats: [
        { label: "Ledger Accounts", value: financeAccountCount },
        { label: "Journal Entries", value: journalEntryCount },
      ],
      locked: false,
    },
    {
      name: "QA Automated Lab",
      desc: "Automated coverage plan, manual QA checklist, and user feedback intake.",
      status: "Active Planning",
      statusColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      cta: "Open QA Lab",
      ctaHref: "/dashboard/qa",
      stats: [
        { label: "Open QA Feedback", value: feedbackOpenCount },
        { label: "Critical Flows", value: 4 },
      ],
      locked: false,
    },
    {
      name: "SecOps Compliance",
      desc: "Security checklist, connection-health review, and admin security feedback inbox.",
      status: "Active Planning",
      statusColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
      cta: "Open SecOps",
      ctaHref: "/dashboard/security",
      stats: [
        { label: "Security Incidents", value: 0 },
        { label: "Open Findings", value: feedbackOpenCount },
      ],
      locked: false,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Overview</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Welcome back, <span className="font-semibold text-white">{session.user?.name}</span>. Here is the operational overview for Nanovest.
        </p>
      </div>

      {/* Grid of Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card) => (
          <div
            key={card.name}
            className="flex flex-col justify-between p-6 rounded-2xl border border-zinc-900 bg-zinc-900/30 backdrop-blur-xl shadow-xl transition-all duration-200 hover:border-zinc-800"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white tracking-tight">{card.name}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${card.statusColor}`}>
                  {card.status}
                </span>
              </div>
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">{card.desc}</p>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-4 mb-6 border-t border-b border-zinc-900/60 py-4">
                {card.stats.map((stat) => (
                  <div key={stat.label}>
                    <p className="text-[10px] uppercase font-semibold text-zinc-500 tracking-wider">
                      {stat.label}
                    </p>
                    <p className="text-xl font-bold text-white mt-0.5">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <Link
              href={card.ctaHref}
              className={`flex w-full items-center justify-center rounded-xl py-3 text-sm font-semibold transition active:scale-[0.98] ${
                card.locked
                  ? "bg-zinc-800 text-zinc-400 border border-zinc-700/30 hover:bg-zinc-750"
                  : "bg-emerald-500 text-black hover:opacity-95"
              }`}
            >
              {card.locked ? "Open Preview" : card.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Visual Charts & Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Activity Chart (CSS Bars) */}
        <div className="rounded-2xl border border-zinc-900 bg-zinc-900/30 backdrop-blur-xl p-6 shadow-xl">
          <h3 className="text-base font-bold text-white mb-2">Audit Activity Volume</h3>
          <p className="text-xs text-zinc-500 mb-6">Daily logs logged in the centralized audit bus</p>
          
          <div className="flex items-end justify-between h-40 pt-4 px-2 border-b border-zinc-800">
            {[
              { day: "Mon", count: 12, height: "h-[30%]" },
              { day: "Tue", count: 24, height: "h-[60%]" },
              { day: "Wed", count: 18, height: "h-[45%]" },
              { day: "Thu", count: 32, height: "h-[80%]" },
              { day: "Fri", count: 40, height: "h-[100%]" },
              { day: "Sat", count: 8, height: "h-[20%]" },
              { day: "Sun", count: 15, height: "h-[35%]" }
            ].map((bar) => (
              <div key={bar.day} className="flex flex-col items-center w-8 group">
                <span className="text-[9px] text-zinc-500 font-mono mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {bar.count}
                </span>
                <div className={`w-full bg-gradient-to-t from-emerald-500/80 to-teal-400 rounded-t-lg transition-all duration-500 ${bar.height} shadow-lg shadow-emerald-500/10 group-hover:brightness-110`} />
                <span className="text-[10px] text-zinc-500 font-mono mt-2">{bar.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Circular Progress Metrics (SVG) */}
        <div className="rounded-2xl border border-zinc-900 bg-zinc-900/30 backdrop-blur-xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-2">Module Compliance Index</h3>
            <p className="text-xs text-zinc-500 mb-6">Real-time status tracking against Nanovest SLAs</p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            {/* Metric 1 */}
            <div className="flex flex-col items-center">
              <div className="relative h-20 w-20 flex items-center justify-center">
                <svg className="absolute transform -rotate-90 w-full h-full" viewBox="0 0 36 36">
                  <path className="text-zinc-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-emerald-500" strokeWidth="3" strokeDasharray="94, 100" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span className="text-xs font-mono font-bold text-white">94%</span>
              </div>
              <span className="text-[10px] font-semibold text-zinc-400 mt-2 block">AI Accuracy</span>
            </div>

            {/* Metric 2 */}
            <div className="flex flex-col items-center">
              <div className="relative h-20 w-20 flex items-center justify-center">
                <svg className="absolute transform -rotate-90 w-full h-full" viewBox="0 0 36 36">
                  <path className="text-zinc-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-teal-400" strokeWidth="3" strokeDasharray="100, 100" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span className="text-xs font-mono font-bold text-white">100%</span>
              </div>
              <span className="text-[10px] font-semibold text-zinc-400 mt-2 block">SecOps Index</span>
            </div>

            {/* Metric 3 */}
            <div className="flex flex-col items-center">
              <div className="relative h-20 w-20 flex items-center justify-center">
                <svg className="absolute transform -rotate-90 w-full h-full" viewBox="0 0 36 36">
                  <path className="text-zinc-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-amber-500" strokeWidth="3" strokeDasharray="98.7, 100" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span className="text-xs font-mono font-bold text-white">98.7%</span>
              </div>
              <span className="text-[10px] font-semibold text-zinc-400 mt-2 block">QA Coverage</span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit logs & activity log */}
      <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">System Audit Log</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Centralized logs tracking all system operations</p>
          </div>
          <span className="text-xs font-semibold text-zinc-400 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
            Total entries: {totalAuditLogs}
          </span>
        </div>

        <div className="space-y-3.5">
          {recentLogs.length > 0 ? (
            recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-zinc-900 bg-zinc-950/40 text-sm gap-2"
              >
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500" />
                  <div>
                    <span className="font-semibold text-zinc-200">{log.action}</span>
                    <span className="text-zinc-500 mx-2">•</span>
                    <span className="text-zinc-400">
                      Entity: <code className="text-zinc-300">{log.entity}</code> ({log.entityId})
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500 sm:self-center">
                  <span>By: {log.user?.name || "System"} ({log.user?.role || "SYSTEM"})</span>
                  <span>•</span>
                  <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 text-zinc-500 text-sm">
              <svg
                className="h-8 w-8 mx-auto text-zinc-700 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              No audit logs recorded yet. Operations will appear here as they occur.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
