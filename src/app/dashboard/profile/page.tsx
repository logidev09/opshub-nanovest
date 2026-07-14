"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { updateUserProfileAction } from "@/features/hr/actions/user.actions";

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [image, setImage] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [division, setDivision] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/auth/session");
        const sessionData = await res.json();

        if (sessionData?.user) {
          // Fetch complete profile from database via user ID
          const response = await fetch(`/api/user/${sessionData.user.id}`);
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const u = result.data;
              setName(u.name || "");
              setEmail(u.email || "");
              setRole(u.role || "");
              setImage(u.image || "");
              setPhone(u.phone || "");
              setBio(u.bio || "");
              setDivision(u.division || "");
            }
          }
        }
      } catch (err) {
        console.error("Gagal memuat data profil:", err);
      } finally {
        setFetching(false);
      }
    }

    loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await updateUserProfileAction({
      name,
      phone,
      bio,
      image,
      division,
    });

    setLoading(false);

    if (res.success) {
      setMessage({ type: "success", text: "Profil Anda berhasil diperbarui!" });
      // Update local NextAuth session state so the sidebar updates instantly
      await updateSession({ name, image });
      router.refresh();
    } else {
      setMessage({ type: "error", text: res.error || "Gagal memperbarui profil." });
    }
  };

  if (fetching) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto mb-4" />
          <p className="text-zinc-500 text-xs">Memuat informasi profil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Ubah Profil</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Ubah informasi nama, foto, kontak, dan biodata akun Anda.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6 md:p-8 backdrop-blur-xl">
        {message && (
          <div
            className={`mb-6 rounded-lg p-4 text-xs font-semibold border ${
              message.type === "success"
                ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/20"
                : "bg-red-950/40 text-red-400 border-red-500/20"
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center text-zinc-300 font-bold text-xl">
              {image ? (
                <img src={image} alt={name} className="h-full w-full object-cover" />
              ) : (
                name[0]?.toUpperCase() || "U"
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{name || "Pengguna"}</h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold mt-0.5">
                {role} · {division || "Divisi Belum Diatur"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-700 outline-none focus:border-emerald-500/80 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Alamat Email (Tidak Dapat Diubah)
              </label>
              <input
                type="email"
                disabled
                value={email}
                className="w-full rounded-xl border border-zinc-900 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-500 outline-none cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Foto Profil (URL Gambar)
              </label>
              <input
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-700 outline-none focus:border-emerald-500/80 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Nomor HP (Opsional)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812xxxxxxx"
                className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-700 outline-none focus:border-emerald-500/80 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Divisi Kerja
            </label>
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/80 transition"
            >
              <option value="">Pilih Divisi...</option>
              <option value="Accounting">Accounting</option>
              <option value="Quality Assurance">Quality Assurance</option>
              <option value="Security Operations & IT Support">
                Security Operations & IT Support
              </option>
              <option value="CX Engineer">CX Engineer</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
              Biodata / Tentang Saya (Opsional)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Ceritakan sedikit tentang diri Anda..."
              rows={3}
              className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-700 outline-none focus:border-emerald-500/80 transition resize-none"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-900">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-emerald-500 text-black font-semibold hover:opacity-95 disabled:opacity-50 transition active:scale-[0.98]"
            >
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
