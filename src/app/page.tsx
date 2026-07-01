"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const githubUrl = "https://github.com/logidev09/opshub-nanovest";
const cafeUrl = "https://warungsasa.alwaysdata.net/";

function LoginForm() {
  const router = useRouter();
  const [callbackUrl, setCallbackUrl] = useState("/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const cb = searchParams.get("callbackUrl");
      if (cb) {
        setCallbackUrl(cb);
      }
    }
  }, []);

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
        setError("Email atau kata sandi tidak valid. Silakan coba lagi.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan tak terduga. Silakan coba lagi.");
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
      <h2 className="text-xl font-semibold text-white mb-6">Masuk</h2>

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
            Alamat Email
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
              Kata Sandi
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
            "Masuk"
          )}
        </button>
      </form>

      {/* Quick Login Section */}
      <div className="mt-8 border-t border-zinc-800 pt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 text-center">
          Akun Demo Cepat
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
          Kata sandi semua akun: <code className="text-zinc-400">password123</code>
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const [showPopup, setShowPopup] = useState(true);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100 font-sans selection:bg-emerald-500 selection:text-black">
      <Link
        href={githubUrl}
        target="_blank"
        rel="noreferrer"
        className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/80 text-zinc-300 shadow-lg backdrop-blur transition hover:border-emerald-500/40 hover:text-emerald-300"
        aria-label="Buka repositori GitHub"
        title="Lihat repositori GitHub"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.477 2 2 6.589 2 12.248c0 4.526 2.865 8.367 6.839 9.722.5.095.682-.221.682-.492 0-.243-.009-.888-.014-1.742-2.782.617-3.369-1.373-3.369-1.373-.455-1.185-1.11-1.5-1.11-1.5-.908-.637.069-.624.069-.624 1.004.072 1.532 1.055 1.532 1.055.892 1.57 2.341 1.116 2.91.853.091-.664.35-1.116.636-1.373-2.221-.259-4.555-1.14-4.555-5.073 0-1.12.39-2.036 1.029-2.754-.103-.26-.446-1.307.098-2.725 0 0 .84-.276 2.75 1.052A9.34 9.34 0 0112 6.836a9.3 9.3 0 012.504.347c1.909-1.328 2.747-1.052 2.747-1.052.546 1.418.203 2.465.1 2.725.64.718 1.027 1.634 1.027 2.754 0 3.943-2.338 4.811-4.566 5.065.359.318.679.946.679 1.907 0 1.377-.012 2.487-.012 2.826 0 .273.18.592.688.491C19.138 20.611 22 16.772 22 12.248 22 6.589 17.523 2 12 2z" />
        </svg>
      </Link>

      {/* Background radial glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-emerald-950/20 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-zinc-900/40 blur-[120px]" />
      </div>

      {/* Cafe Popup - Bottom Right */}
      {showPopup && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 backdrop-blur-xl p-3 shadow-2xl max-w-[280px]">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-semibold text-white">Website Pemesanan Cafe + AI Chat</h3>
              <button
                onClick={() => setShowPopup(false)}
                className="text-zinc-400 hover:text-white transition ml-2"
                aria-label="Tutup"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <Link
              href={cafeUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-emerald-400 hover:text-emerald-300 transition underline"
            >
              {cafeUrl}
            </Link>
          </div>
        </div>
      )}

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
          <p className="mt-2 text-xs text-zinc-500">
            Portofolio ini dibuat oleh <span className="font-semibold text-zinc-300">Ilham Rizkyansyah</span> · Universitas Gunadarma Informatika
          </p>
        </div>

        {/* Card containing login form */}
        <LoginForm />

        <p className="mt-8 text-center text-xs text-zinc-500">
          OpsHub © 2026 Nanovest. Untuk penggunaan internal.
        </p>
      </div>
    </div>
  );
}