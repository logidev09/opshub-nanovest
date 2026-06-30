"use client";

import { useState } from "react";

interface TestSuite {
  name: string;
  method: "GET" | "POST";
  url: string;
  status: "PENDING" | "RUNNING" | "PASSED" | "FAILED";
  time: string;
}

export default function QaTeaserPage() {
  const [tests, setTests] = useState<TestSuite[]>([
    { name: "Auth Endpoint Verification", method: "POST", url: "/api/auth/callback/credentials", status: "PASSED", time: "120ms" },
    { name: "HR Vector Search Latency Test", method: "GET", url: "/api/chat?search=leave", status: "PASSED", time: "85ms" },
    { name: "Guardrail Defense Boundary Test", method: "POST", url: "/api/chat", status: "PASSED", time: "240ms" },
    { name: "Middleware CSP Header Injection Check", method: "GET", url: "/dashboard", status: "PASSED", time: "45ms" },
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [successCount, setSuccessCount] = useState(4);

  const runPlaywrightSuite = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setSuccessCount(0);

    // Reset all test statuses to pending
    const resetTests = tests.map((t) => ({ ...t, status: "PENDING" as const, time: "..." }));
    setTests(resetTests);

    // Run tests sequentially
    for (let i = 0; i < resetTests.length; i++) {
      // 1. Set current test to RUNNING
      setTests((prev) =>
        prev.map((t, idx) => (idx === i ? { ...t, status: "RUNNING" as const } : t))
      );

      // 2. Wait for simulated execution
      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 500));

      // 3. Mark as PASSED and update latency
      const finalLatency = `${Math.floor(40 + Math.random() * 200)}ms`;
      setTests((prev) =>
        prev.map((t, idx) =>
          idx === i ? { ...t, status: "PASSED" as const, time: finalLatency } : t
        )
      );
      setSuccessCount((prev) => prev + 1);
    }

    setIsRunning(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-900 pb-6 gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold text-emerald-400 mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Interactive QA Module
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">QA Automated Lab</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Automated API Testing, Playwright UI validation, and test report tracking.
          </p>
        </div>
        <button
          onClick={runPlaywrightSuite}
          disabled={isRunning}
          className="sm:self-end px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/10 transition disabled:opacity-50 disabled:scale-100 active:scale-95"
        >
          {isRunning ? "Running Suite..." : "Run Playwright Test Suite"}
        </button>
      </div>

      {/* Warning/Alert box */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h3 className="text-base font-bold text-white mb-2">Nanovest QA Requirement Showcase</h3>
        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
          To fulfill the **QA Specialist Intern** guidelines, this module is planned to integrate direct Playwright test suites that validate frontend UI flows, and Postman/Newman collections validating REST endpoints.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-900">
            <span className="text-emerald-400 block mb-1">Playwright Integration</span>
            <span className="text-zinc-500 font-medium">Headless browser automation scripts mapping the platform's Happy Paths.</span>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-900">
            <span className="text-emerald-400 block mb-1">CI/CD Pipeline Checks</span>
            <span className="text-zinc-500 font-medium">Integrates with GitHub Actions to block breaking builds on pull request review.</span>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-900">
            <span className="text-emerald-400 block mb-1">API Load Testing</span>
            <span className="text-zinc-500 font-medium">Endpoint health monitor verifying status code, schema formats, and SLA metrics.</span>
          </div>
        </div>
      </div>

      {/* Mock Test Runner Preview */}
      <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6">
        <div className="flex items-center justify-between mb-6 border-b border-zinc-900 pb-4">
          <h3 className="text-base font-bold text-white">Active Test Case Runner</h3>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
            successCount === 4 
              ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" 
              : "text-amber-400 bg-amber-500/10 border border-amber-500/20"
          }`}>
            {successCount} / 4 Passed ({Math.floor((successCount / 4) * 100)}%)
          </span>
        </div>
        <div className="space-y-3.5">
          {tests.map((test) => (
            <div
              key={test.name}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition duration-200 ${
                test.status === "RUNNING"
                  ? "border-emerald-500/40 bg-emerald-950/10 shadow-lg shadow-emerald-500/5"
                  : "border-zinc-900 bg-zinc-950/40"
              } text-sm gap-2`}
            >
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  test.method === "POST" 
                    ? "bg-emerald-950/40 text-emerald-400 border border-emerald-500/20" 
                    : "bg-zinc-800 text-zinc-300"
                }`}>
                  {test.method}
                </span>
                <div>
                  <span className="font-semibold text-white">{test.name}</span>
                  <span className="text-zinc-500 block text-xs mt-0.5">{test.url}</span>
                </div>
              </div>
              <div className="flex items-center gap-3.5 text-xs sm:self-center">
                {test.status === "RUNNING" && (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border border-emerald-500 border-t-transparent" />
                )}
                <span className="text-zinc-500 font-mono">{test.time}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                  test.status === "PASSED"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : test.status === "RUNNING"
                    ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10"
                    : test.status === "PENDING"
                    ? "bg-zinc-900 text-zinc-500 border-zinc-800"
                    : "bg-red-500/10 text-red-400 border-red-500/20"
                }`}>
                  {test.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
