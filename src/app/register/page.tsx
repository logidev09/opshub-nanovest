"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [division, setDivision] = useState("CX Engineer");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, division }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Terjadi kesalahan saat mendaftar.");
      } else {
        setSuccess("Pendaftaran sukses! Mengalihkan ke halaman masuk...");
        setTimeout(() => {
          router.push("/");
        }, 1500);
      }
    } catch {
      setError("Gagal terhubung ke server. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100 font-sans selection:bg-emerald-500 selection:text-black">
      {/* Background radial glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-emerald-950/20 blur-[120px]" />
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-zinc-900/40 blur-[120px]" />
      </div>

      <div className="w-full max-w-md z-10">
        {/* Title */}
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
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Daftar <span className="text-emerald-400">Employee</span>
          </h1>
          <p className="mt-2 text-zinc-400 text-sm">
            Buat akun internal Nanovest baru untuk mengakses portal
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Registrasi Akun</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-950/50 border border-red-500/30 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg bg-emerald-950/50 border border-emerald-500/30 p-3 text-sm text-emerald-400 animate-pulse">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2"
              >
                Nama Lengkap
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition duration-200 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/80"
              />
            </div>

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
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2"
              >
                Kata Sandi
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 karakter"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition duration-200 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/80"
              />
            </div>

            <div>
              <label
                htmlFor="division"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2"
              >
                Divisi Kerja
              </label>
              <select
                id="division"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white outline-none transition duration-200 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/80"
              >
                <option value="Accounting">Accounting</option>
                <option value="Quality Assurance">Quality Assurance</option>
                <option value="Security Operations & IT Support">
                  Security Operations & IT Support
                </option>
                <option value="CX Engineer">CX Engineer</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="relative flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3.5 text-sm font-semibold text-black transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
              ) : (
                "Daftar Akun"
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-zinc-850 pt-4 text-center">
            <p className="text-xs text-zinc-500">
              Sudah memiliki akun?{" "}
              <Link href="/" className="text-emerald-400 hover:text-emerald-300 font-semibold transition">
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-500">
          OpsHub © 2026 Nanovest. Untuk penggunaan internal.
        </p>
      </div>
    </div>
  );
}
