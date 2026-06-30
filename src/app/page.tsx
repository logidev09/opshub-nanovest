"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl,
      });

      if (res?.error) {
        setError("Invalid email or password. Please try again.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl p-8 shadow-2xl">
      <h2 className="text-xl font-semibold text-white mb-6">Sign In</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-950/50 border border-red-500/30 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@nanovest.io"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition duration-200 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/80"
          />
        </div>

        <div>
          <div className="flex justify-between mb-2">
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-400"
            >
              Password
            </label>
          </div>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition duration-200 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/80"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="relative flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3.5 text-sm font-semibold text-black transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      {/* Quick Login Section */}
      <div className="mt-8 border-t border-zinc-800 pt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 text-center">
          Quick Demo Accounts
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleQuickLogin("admin@nanovest.io")}
            className="rounded-lg bg-zinc-950 border border-zinc-800 py-2 px-1 text-[11px] font-medium text-emerald-400 hover:bg-zinc-900 transition"
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => handleQuickLogin("hr@nanovest.io")}
            className="rounded-lg bg-zinc-950 border border-zinc-800 py-2 px-1 text-[11px] font-medium text-emerald-400 hover:bg-zinc-900 transition"
          >
            HR Specialist
          </button>
          <button
            type="button"
            onClick={() => handleQuickLogin("user@nanovest.io")}
            className="rounded-lg bg-zinc-950 border border-zinc-800 py-2 px-1 text-[11px] font-medium text-emerald-400 hover:bg-zinc-900 transition"
          >
            Employee
          </button>
        </div>
        <p className="text-[10px] text-zinc-500 text-center mt-3">
          Password for all accounts is: <code className="text-zinc-400">password123</code>
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100 font-sans selection:bg-emerald-500 selection:text-black">
      {/* Background radial glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-emerald-950/20 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-zinc-900/40 blur-[120px]" />
      </div>

      <div className="w-full max-w-md z-10">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 p-2.5 shadow-lg shadow-emerald-500/20 mb-4">
            <svg
              className="h-6 w-6 text-black"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Clubhouse <span className="text-emerald-400">OpsHub</span>
          </h1>
          <p className="mt-2 text-zinc-400 text-sm">
            Internal Operations Portal & AI Copilot Platform
          </p>
        </div>

        {/* Card containing login form wrapped in Suspense */}
        <Suspense
          fallback={
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl p-8 shadow-2xl text-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto mb-4" />
              <p className="text-zinc-500 text-xs">Loading authentication interface...</p>
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <p className="mt-8 text-center text-xs text-zinc-500">
          OpsHub © 2026 Nanovest. For internal use only.
        </p>
      </div>
    </div>
  );
}