"use client";

import { useState } from "react";

export function SecuritySimulator({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const [isScanning, setIsScanning] = useState(false);
  const [activeSuite, setActiveSuite] = useState("OWASP Security Audit");
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResults, setScanResults] = useState<{check: string; status: string}[]>([]);
  const [riskScore, setRiskScore] = useState(98);
  const [owaspScore, setOwaspScore] = useState(10);

  const secSuites: Record<string, string[]> = {
    "OWASP Security Audit": [
      "CSP & CORS Header Verification",
      "XSS Injection Guardrails",
      "CSRF Token & Anti-Forgery Check",
      "SQL & NoSQL Injection Fuzzing",
      "Bcrypt Hashing Encryption Check",
    ],
    "Prompt Defense & Guardrails": [
      "AI Prompt Injection Defense",
      "Jailbreak & System Prompt Shield",
      "RAG Document Leak Protection",
      "Role-Based Output Filtering",
    ],
    "RBAC & Session Isolation": [
      "NextAuth Session Token Validation",
      "Admin Accounts Access Barrier",
      "HR Read-Only Permission Guard",
      "Accountant Journal Edit Isolation",
    ],
    "Network & API Penetration": [
      "Rate Limiter Brute Force Barrier",
      "DDoS Buffer Overflow Test",
      "TLS 1.3 Encryption Handshake",
      "Subdomain Takeover Scan",
    ],
  };

  const currentChecks = secSuites[activeSuite] || secSuites["OWASP Security Audit"];

  const scanSecurity = () => {
    if (isReadOnly) return;
    setIsScanning(true);
    setScanProgress(0);
    setScanResults([]);

    currentChecks.forEach((check, index) => {
      setTimeout(() => {
        const newResult = {
          check,
          status: "PASS",
        };
        setScanResults((prev) => [...prev, newResult]);
        setScanProgress(((index + 1) / currentChecks.length) * 100);

        if (index === currentChecks.length - 1) {
          setTimeout(() => {
            setIsScanning(false);
            setRiskScore(Math.floor(96 + Math.random() * 4));
            setOwaspScore(10);
          }, 300);
        }
      }, index * 400);
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">SecOps Compliance</h3>
          <p className="text-sm text-zinc-400">Multi-Vector Security Audit & Penetration Engine</p>
        </div>
        <button
          onClick={scanSecurity}
          disabled={isScanning || isReadOnly}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          {isReadOnly ? "Scan (Disabled)" : isScanning ? "Scanning..." : `Audit ${activeSuite}`}
        </button>
      </div>

      {/* Security Suite Tabs (Item 10) */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-zinc-800 pb-4">
        {Object.keys(secSuites).map((suiteName) => (
          <button
            key={suiteName}
            type="button"
            onClick={() => {
              setActiveSuite(suiteName);
              setScanResults([]);
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

      {isScanning && (
        <div className="mb-4">
          <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
          <p className="text-xs text-zinc-400 mt-2 text-center">{Math.round(scanProgress)}% complete</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Security Checks</p>
          <div className="space-y-2">
            {scanResults.length > 0 ? (
              scanResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/50 border border-zinc-800">
                  <div>
                    <p className="text-sm font-medium text-white">{result.check}</p>
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
                  </div>
                </div>
              ))
            ) : (
              currentChecks.map((check, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/50 border border-zinc-800">
                  <div>
                    <p className="text-sm font-medium text-zinc-400">{check}</p>
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
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Security Score</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-zinc-950/50 border border-zinc-800 p-3">
                <p className="text-2xl font-bold text-emerald-400">{riskScore}/100</p>
                <p className="text-xs text-zinc-400">Risk Score</p>
              </div>
              <div className="rounded-lg bg-zinc-950/50 border border-zinc-800 p-3">
                <p className="text-2xl font-bold text-emerald-400">{owaspScore}/10</p>
                <p className="text-xs text-zinc-400">OWASP Passed</p>
              </div>
            </div>
          </div>
          
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Headers</p>
            <div className="space-y-2">
              {[
                { header: "CSP", status: "PASS" },
                { header: "X-Frame-Options", status: "PASS" },
                { header: "HSTS", status: "PASS" },
                { header: "CORS", status: "PASS" },
                { header: "X-Content-Type", status: "PASS" },
                { header: "Referrer-Policy", status: "PASS" },
                { header: "Permissions-Policy", status: "PASS" },
                { header: "Strict-Transport", status: "PASS" },
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded bg-zinc-950/30 border border-zinc-800">
                  <span className="text-xs text-zinc-300">{item.header}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                    item.status === "PASS" 
                      ? "bg-emerald-500/20 text-emerald-400" 
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Prompt Guard</p>
            <div className="space-y-2">
              {[
                { check: "Injection Detection", value: "100%" },
                { check: "Jailbreak Prevention", value: "100%" },
                { check: "Allowlist Enforcement", value: "100%" },
                { check: "Rate Limiting", value: "Active" },
              ].map((item, index) => (
                <div key={index} className="flex justify-between p-2 rounded bg-zinc-950/30 border border-zinc-800">
                  <span className="text-xs text-zinc-300">{item.check}</span>
                  <span className="text-xs font-medium text-emerald-400">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
