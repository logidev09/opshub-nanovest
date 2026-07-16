"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type SessionUser = {
  name?: string | null;
  role?: string;
  division?: string | null;
};

// Inline SVG Icon components for simplicity and aesthetics
const IconHome = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const IconHr = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const IconFinance = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconQa = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const IconSecurity = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const IconAdmin = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 20h5v-1a3 3 0 00-5.356-1.857M17 20H7m10 0v-1c0-.656-.126-1.283-.356-1.857M7 20H2v-1a3 3 0 015.356-1.857M7 20v-1c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

function formatRoleLabel(role?: string) {
  if (role === "USER") return "EMPLOYEE";
  return role || "EMPLOYEE";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const sessionUser = session?.user as SessionUser | undefined;

  const navigation = [
    ...(sessionUser?.role === "ADMIN" || sessionUser?.division === "CX Engineer"
      ? [{ name: "Overview", href: "/dashboard", icon: IconHome }]
      : []),
    ...(sessionUser?.role === "HR" || sessionUser?.role === "ADMIN" || sessionUser?.division === "HR"
      ? [{ name: "HR Copilot (AI)", href: "/dashboard/hr", icon: IconHr }]
      : []),
    ...(sessionUser?.division === "Accounting" || sessionUser?.role === "ADMIN" || sessionUser?.role === "HR"
      ? [{ name: "Finance Ledger", href: "/dashboard/finance", icon: IconFinance }]
      : []),
    ...(sessionUser?.division === "Quality Assurance" || sessionUser?.role === "ADMIN" || sessionUser?.division === "Security Operations & IT Support"
      ? [{ name: "QA Lab", href: "/dashboard/qa", icon: IconQa }]
      : []),
    ...(sessionUser?.division === "Security Operations & IT Support" || sessionUser?.role === "ADMIN" || sessionUser?.division === "Quality Assurance"
      ? [{ name: "SecOps", href: "/dashboard/security", icon: IconSecurity }]
      : []),
    ...(sessionUser?.role === "ADMIN"
      ? [{ name: "Admin Accounts", href: "/dashboard/admin", icon: IconAdmin }]
      : []),
  ];

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Static sidebar for desktop */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64 border-r border-zinc-900 bg-zinc-900/40">
          <div className="flex items-center h-16 px-6 border-b border-zinc-900 bg-zinc-950/20">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 shadow-md shadow-emerald-500/10 mr-3">
              <svg className="h-4.5 w-4.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              OpsHub <span className="text-emerald-400">Nanovest</span>
            </span>
          </div>

          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <nav className="flex-1 px-4 space-y-1 bg-transparent">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition duration-150 ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-900/50"
                    }`}
                  >
                    <span className={`mr-3 ${isActive ? "text-emerald-400" : "text-zinc-500"}`}>
                      <Icon />
                    </span>
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User profile drawer */}
          <div className="flex-shrink-0 flex border-t border-zinc-900 p-4 bg-zinc-950/20">
            <div className="flex items-center w-full justify-between">
              <Link href="/dashboard/profile" className="flex items-center group cursor-pointer">
                <div className="inline-block h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center text-zinc-300 font-semibold text-sm group-hover:border-emerald-500/50 transition">
                  {session?.user?.image ? (
                    <img src={session.user.image} alt={sessionUser?.name || "U"} className="h-full w-full object-cover" />
                  ) : (
                    session?.user?.name?.[0]?.toUpperCase() || "U"
                  )}
                </div>
                <div className="ml-3 text-left">
                  <p className="text-xs font-semibold text-white truncate max-w-[120px] group-hover:text-emerald-400 transition">
                    {sessionUser?.name || "Pengguna"}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-medium tracking-wide uppercase">
                    {formatRoleLabel(sessionUser?.role)}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition duration-150"
                title="Sign Out"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        {/* Mobile top nav header */}
        <div className="md:hidden flex items-center justify-between h-16 bg-zinc-900 border-b border-zinc-800 px-4">
          <div className="flex items-center">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 mr-2.5">
              <svg className="h-4.5 w-4.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-base font-bold text-white">OpsHub</span>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-lg text-zinc-400 hover:text-white focus:outline-none"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu Backdrop */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}

        {/* Mobile Menu Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col transform transition-transform duration-300 md:hidden ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center h-16 px-6 border-b border-zinc-800 bg-zinc-950/20">
            <span className="text-lg font-bold text-white">OpsHub Nanovest</span>
          </div>
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  <span className={`mr-3 ${isActive ? "text-emerald-400" : "text-zinc-500"}`}>
                    <Icon />
                  </span>
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="flex-shrink-0 flex border-t border-zinc-800 p-4 bg-zinc-950/20">
            <div className="flex items-center w-full justify-between">
              <Link
                href="/dashboard/profile"
                onClick={() => setMobileOpen(false)}
                className="flex items-center group cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center text-zinc-300 font-semibold text-xs group-hover:border-emerald-500/50 transition">
                  {session?.user?.image ? (
                    <img src={session.user.image} alt={sessionUser?.name || "U"} className="h-full w-full object-cover" />
                  ) : (
                    session?.user?.name?.[0]?.toUpperCase() || "U"
                  )}
                </div>
                <div className="ml-3 text-left">
                  <p className="text-xs font-semibold text-white group-hover:text-emerald-400 transition">
                    {sessionUser?.name || "Pengguna"}
                  </p>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wide">
                    {formatRoleLabel(sessionUser?.role)}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-zinc-950 focus:outline-none p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <div>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
