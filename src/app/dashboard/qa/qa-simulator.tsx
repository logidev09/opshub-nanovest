"use client";

import { useState } from "react";

export function PlaywrightSimulator({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const [isRunning, setIsRunning] = useState(false);
  const [activeSuite, setActiveSuite] = useState("Playwright E2E");
  const [progress, setProgress] = useState(0);
  const [testResults, setTestResults] = useState<{name: string; status: string; duration: string}[]>([]);
  const [coverage, setCoverage] = useState(94);
  const [totalDuration, setTotalDuration] = useState("2.81");

  const suites: Record<string, { name: string; duration: string }[]> = {
    "Playwright E2E": [
      { name: "Login & Auth Flow", duration: "45ms" },
      { name: "Register Employee", duration: "62ms" },
      { name: "AI Chat Assistant", duration: "88ms" },
      { name: "Leave Submission", duration: "120ms" },
      { name: "Finance Ledger Posting", duration: "75ms" },
      { name: "Feedback Inbox Workflow", duration: "55ms" },
    ],
    "OWASP Security Audit": [
      { name: "CSP & CORS Header Verification", duration: "12ms" },
      { name: "XSS Injection Guardrails", duration: "18ms" },
      { name: "CSRF & Anti-Forgery Check", duration: "15ms" },
      { name: "SQL & NoSQL Injection Fuzz", duration: "32ms" },
    ],
    "SAST Vulnerability Scan": [
      { name: "Dependency Vulnerability Scan", duration: "210ms" },
      { name: "AST Code Analysis", duration: "340ms" },
      { name: "Secret & Credential Leak Check", duration: "95ms" },
    ],
    "API Fuzzing & Latency": [
      { name: "POST /api/chat Stress Test", duration: "180ms" },
      { name: "GET /dashboard Latency Benchmark", duration: "42ms" },
      { name: "Rate Limiter Throttle Test", duration: "65ms" },
    ],
    "RBAC Permission Matrix": [
      { name: "Admin Permission Barrier", duration: "10ms" },
      { name: "HR Specialist Read-Only Guard", duration: "12ms" },
      { name: "Accountant Journal Edit Isolation", duration: "14ms" },
    ],
    "Performance Benchmark": [
      { name: "TTFB First Byte Test", duration: "22ms" },
      { name: "LCP Largest Contentful Paint", duration: "310ms" },
      { name: "Memory Leak Garbage Collector Check", duration: "450ms" },
    ],
  };

  const currentTests = suites[activeSuite] || suites["Playwright E2E"];

  const runTests = () => {
    if (isReadOnly) return;
    setIsRunning(true);
    setProgress(0);
    setTestResults([]);

    currentTests.forEach((test, index) => {
      setTimeout(() => {
        const newResult = {
          name: test.name,
          status: "PASS",
          duration: test.duration,
        };
        setTestResults((prev) => [...prev, newResult]);
        setProgress(((index + 1) / currentTests.length) * 100);

        if (index === currentTests.length - 1) {
          setTimeout(() => {
            setIsRunning(false);
            setCoverage(Math.floor(92 + Math.random() * 7));
            setTotalDuration((1.5 + Math.random() * 1.5).toFixed(2));
          }, 300);
        }
      }, index * 400);
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">QA Automated Lab</h3>
          <p className="text-sm text-zinc-400">Multi-Suite Automated Test Simulation Engine</p>
        </div>
        <button
          onClick={runTests}
          disabled={isRunning || isReadOnly}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          {isReadOnly ? "Run Test (Disabled)" : isRunning ? "Running Suite..." : `Run ${activeSuite}`}
        </button>
      </div>

      {/* Test Suite Selector Tabs (Item 10) */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-zinc-800 pb-4">
        {Object.keys(suites).map((suiteName) => (
          <button
            key={suiteName}
            type="button"
            onClick={() => {
              setActiveSuite(suiteName);
              setTestResults([]);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeSuite === suiteName
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-zinc-950 text-zinc-400 border border-zinc-850 hover:text-white"
            }`}
          >
            {suiteName}
          </button>
        ))}
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
              currentTests.map((test, index) => (
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
