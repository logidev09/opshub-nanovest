"use client";

import { useState } from "react";

export function PlaywrightSimulator() {
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
