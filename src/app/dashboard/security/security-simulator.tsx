"use client";

import { useState } from "react";

export function SecuritySimulator({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResults, setScanResults] = useState<{check: string; status: string}[]>([]);
  const [riskScore, setRiskScore] = useState(0);
  const [owaspScore, setOwaspScore] = useState(0);

  const securityChecks = [
    { check: "CSP", status: "PENDING" },
    { check: "XSS", status: "PENDING" },
    { check: "CSRF", status: "PENDING" },
    { check: "JWT", status: "PENDING" },
    { check: "HTTPS", status: "PENDING" },
    { check: "Prompt Injection", status: "PENDING" },
    { check: "RBAC", status: "PENDING" },
    { check: "Audit Log", status: "PENDING" },
  ];

  const scanSecurity = () => {
    if (isReadOnly) return;
    setIsScanning(true);
    setScanProgress(0);
    setScanResults([]);
    setRiskScore(0);
    setOwaspScore(0);

    securityChecks.forEach((check, index) => {
      setTimeout(() => {
        const newResult = {
          check: check.check,
          status: "PASS"
        };
        setScanResults(prev => [...prev, newResult]);
        setScanProgress(((index + 1) / securityChecks.length) * 100);
        
        if (index === securityChecks.length - 1) {
          setTimeout(() => {
            setIsScanning(false);
            setRiskScore(98);
            setOwaspScore(10);
          }, 500);
        }
      }, index * 600);
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">SecOps Compliance</h3>
          <p className="text-sm text-zinc-400">Security Scanner Simulation</p>
        </div>
        <button
          onClick={scanSecurity}
          disabled={isScanning || isReadOnly}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          {isReadOnly ? "Scan Compliance (Disabled)" : isScanning ? "Scanning..." : "Audit Security Compliance"}
        </button>
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
              securityChecks.map((check, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/50 border border-zinc-800">
                  <div>
                    <p className="text-sm font-medium text-zinc-400">{check.check}</p>
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
