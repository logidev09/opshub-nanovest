import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/features/shared/lib/db";
import { FeedbackPanel } from "@/features/feedback/components/feedback-panel";
import { useState } from "react";

type SessionUser = {
  role?: string;
};

const automatedTests = [
  ["Playwright UI", "Login valid/invalid, chat send flow, auto-submit leave via AI, admin account management"],
  ["API Contract", "POST /api/chat, auth callback, feedback submission, finance posting action"],
  ["Regression", "Tanggal kalender, avatar kiri/kanan chat, status leave pending, role-based navigation"],
  ["Performance", "Latency chat, query ledger snapshot, audit log rendering, feedback inbox load"],
];

const manualTests = [
  "Uji employee mengirim feedback QA dan pastikan admin menerima item baru di inbox.",
  "Uji admin mengubah status feedback dari OPEN ke IN_REVIEW dan RESOLVED.",
  "Uji visual date picker, alignment bubble AI/user, dan role label di sidebar.",
  "Uji akses role: employee tidak boleh melihat halaman admin account center.",
];

function PlaywrightSimulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [testResults, setTestResults] = useState<{name: string; status: string; duration: string}[]>([]);
  const [coverage, setCoverage] = useState(0);
  const [totalDuration, setTotalDuration] = useState("0.00");

  const tests = [
    { name: "Login", status: "PENDING", duration: "" },
    { name: "Register", status: "PENDING", duration: "" },
    { name: "Chat AI", status: "PENDING", duration: "" },
    { name: "Leave Request", status: "PENDING", duration: "" },
    { name: "Finance Approval", status: "PENDING", duration: "" },
    { name: "Feedback Inbox", status: "PENDING", duration: "" },
  ];

  const runTests = () => {
    setIsRunning(true);
    setProgress(0);
    setTestResults([]);
    setCoverage(0);
    setTotalDuration("0.00");

    tests.forEach((test, index) => {
      setTimeout(() => {
        const statuses = ["PASS", "PASS", "PASS", "PASS", "PASS", "PASS"];
        const durations = ["45ms", "62ms", "88ms", "120ms", "75ms", "55ms"];
        const newResult = {
          name: test.name,
          status: statuses[index] || "PASS",
          duration: durations[index] || "100ms"
        };
        setTestResults(prev => [...prev, newResult]);
        setProgress(((index + 1) / tests.length) * 100);
        
        if (index === tests.length - 1) {
          setTimeout(() => {
            setIsRunning(false);
            setCoverage(93);
            setTotalDuration("2.81");
          }, 500);
        }
      }, index * 800);
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">QA Automated Lab</h3>
          <p className="text-sm text-zinc-400">Playwright Test Suite Simulation</p>
        </div>
        <button
          onClick={runTests}
          disabled={isRunning}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          {isRunning ? "Running..." : "Run Playwright Test Suite"}
        </button>
      </div>

      {isRunning && (
        <div className="mb-4">
          <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-zinc-400 mt-2 text-center">{Math.round(progress)}% complete</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Test Results</p>
          <div className="space-y-2">
            {testResults.length > 0 ? (
              testResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/50 border border-zinc-800">
                  <div>
                    <p className="text-sm font-medium text-white">{result.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      result.status === "PASS" 
                        ? "bg-emerald-500/20 text-emerald-400" 
                        : result.status === "FAIL" 
                          ? "bg-red-500/20 text-red-400" 
                          : "bg-zinc-700 text-zinc-300"
                    }`}>
                      {result.status}
                    </span>
                    <span className="text-xs text-zinc-400">{result.duration}</span>
                  </div>
                </div>
              ))
            ) : (
              tests.map((test, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/50 border border-zinc-800">
                  <div>
                    <p className="text-sm font-medium text-zinc-400">{test.name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">PENDING</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Metrics</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-zinc-950/50 border border-zinc-800 p-3">
                <p className="text-2xl font-bold text-emerald-400">{coverage}%</p>
                <p className="text-xs text-zinc-400">Coverage</p>
              </div>
              <div className="rounded-lg bg-zinc-950/50 border border-zinc-800 p-3">
                <p className="text-2xl font-bold text-emerald-400">{totalDuration}s</p>
                <p className="text-xs text-zinc-400">Duration</p>
              </div>
            </div>
          </div>
          
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">API Endpoints</p>
            <div className="space-y-2">
              {[
                { endpoint: "POST /api/chat", status: 200, latency: "48ms" },
                { endpoint: "GET /api/leave", status: 200, latency: "63ms" },
                { endpoint: "POST /api/feedback", status: 201, latency: "41ms" },
                { endpoint: "PUT /api/admin/feedback", status: 200, latency: "55ms" },
              ].map((api, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded bg-zinc-950/30 border border-zinc-800">
                  <span className="text-xs text-zinc-300">{api.endpoint}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">{api.status}</span>
                    <span className="text-xs text-zinc-400">{api.latency}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Performance</p>
            <div className="space-y-2">
              {[
                { metric: "TTFB", value: "71ms" },
                { metric: "LCP", value: "1.2s" },
                { metric: "CLS", value: "0.01" },
                { metric: "Bundle", value: "298KB" },
              ].map((item, index) => (
                <div key={index} className="flex justify-between p-2 rounded bg-zinc-950/30 border border-zinc-800">
                  <span className="text-xs text-zinc-300">{item.metric}</span>
                  <span className="text-xs font-medium text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function QaLabPage() {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as SessionUser | undefined)?.role || "USER";

  const feedbackItems = await prisma.systemFeedback.findMany({
    where: { module: "QA" },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      submittedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-zinc-900 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            QA Execution Plan
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">QA Automated Lab</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Simulasi test otomatis, rekomendasi test, checklist manual, dan feedback user.
          </p>
        </div>
      </div>

      <PlaywrightSimulator />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h3 className="mb-4 text-base font-bold text-white">Test Otomatis yang Perlu Ditambahkan</h3>
          <div className="space-y-3">
            {automatedTests.map(([title, description]) => (
              <div key={title} className="rounded-xl border border-zinc-900 bg-zinc-950 p-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6">
          <h3 className="mb-4 text-base font-bold text-white">Checklist QA Manual</h3>
          <div className="space-y-3">
            {manualTests.map((test) => (
              <div key={test} className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4 text-sm text-zinc-300">
                {test}
              </div>
            ))}
          </div>
        </div>
      </div>

      <FeedbackPanel
        module="QA"
        userRole={userRole}
        feedbackItems={feedbackItems.map((item) => ({
          id: item.id,
          category: item.category,
          message: item.message,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
          submittedBy: item.submittedBy,
        }))}
      />
    </div>
  );
}
