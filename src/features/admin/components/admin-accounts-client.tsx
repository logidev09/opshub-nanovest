"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Role } from "@prisma/client";
import {
  createUserAction,
  toggleUserStatusAction,
  updateUserPasswordAction,
  updateUserRoleAction,
} from "@/features/hr/actions/user.actions";

interface AccountRow {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  image?: string | null;
}

interface AdminAccountsClientProps {
  accounts: AccountRow[];
}

const ROLE_OPTIONS: Role[] = ["USER", "HR", "ADMIN"];

function formatRoleLabel(role: Role) {
  if (role === "USER") return "Employee";
  return role;
}

export function AdminAccountsClient({ accounts }: AdminAccountsClientProps) {
  const router = useRouter();
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<Role>("USER");
  const [createLoading, setCreateLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [roleLoadingId, setRoleLoadingId] = useState<string | null>(null);
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [passwordLoadingId, setPasswordLoadingId] = useState<string | null>(null);
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});

  const activeCount = useMemo(() => accounts.filter((account) => account.isActive).length, [accounts]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setMessage(null);

    const result = await createUserAction({
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      role: newUserRole,
    });

    setCreateLoading(false);
    if (!result.success) {
      setMessage({
        type: "error",
        text: result.error || "Gagal membuat akun baru.",
      });
      return;
    }

    setMessage({
      type: "success",
      text: result.message || "Akun baru berhasil dibuat.",
    });
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserRole("USER");
    router.refresh();
  };

  const handleRoleChange = async (userId: string, role: Role) => {
    setRoleLoadingId(userId);
    setMessage(null);
    const result = await updateUserRoleAction(userId, role);
    setRoleLoadingId(null);

    if (!result.success) {
      setMessage({ type: "error", text: result.error || "Gagal mengubah role akun." });
      return;
    }

    setMessage({ type: "success", text: "Role akun berhasil diperbarui." });
    router.refresh();
  };

  const handleStatusToggle = async (userId: string, nextActiveState: boolean) => {
    setStatusLoadingId(userId);
    setMessage(null);
    const result = await toggleUserStatusAction(userId, nextActiveState);
    setStatusLoadingId(null);

    if (!result.success) {
      setMessage({ type: "error", text: result.error || "Gagal memperbarui status akun." });
      return;
    }

    setMessage({
      type: "success",
      text: nextActiveState ? "Akun berhasil diaktifkan." : "Akun berhasil dinonaktifkan.",
    });
    router.refresh();
  };

  const handlePasswordReset = async (userId: string) => {
    const nextPassword = (passwordDrafts[userId] || "").trim();
    if (!nextPassword) {
      setMessage({ type: "error", text: "Masukkan kata sandi baru sebelum menyimpan." });
      return;
    }

    setPasswordLoadingId(userId);
    setMessage(null);
    const result = await updateUserPasswordAction(userId, nextPassword);
    setPasswordLoadingId(null);

    if (!result.success) {
      setMessage({ type: "error", text: result.error || "Gagal memperbarui kata sandi." });
      return;
    }

    setPasswordDrafts((prev) => ({ ...prev, [userId]: "" }));
    setMessage({
      type: "success",
      text: result.message || "Kata sandi akun berhasil diperbarui.",
    });
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,1.8fr]">
        <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-white">Tambah Akun Baru</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Password tidak pernah ditampilkan kembali dalam bentuk asli. Tabel hanya menandai bahwa password tersimpan aman dalam bentuk terenkripsi.
            </p>
          </div>

          {message && (
            <div
              className={`mb-4 rounded-xl border p-3 text-xs font-semibold ${
                message.type === "success"
                  ? "border-emerald-500/20 bg-emerald-950/40 text-emerald-400"
                  : "border-red-500/20 bg-red-950/40 text-red-400"
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Nama
              </label>
              <input
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Nama lengkap"
                className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Email
              </label>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="employee@nanovest.io"
                className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Password Awal
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as Role)}
                  className="w-full rounded-xl border border-zinc-850 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-200 outline-none focus:border-emerald-500"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {formatRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={
                createLoading || !newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()
              }
              className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-black transition hover:opacity-95 disabled:opacity-50"
            >
              {createLoading ? "Membuat akun..." : "Tambah Akun"}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Akun</p>
            <p className="mt-3 text-3xl font-extrabold text-white">{accounts.length}</p>
          </div>
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Akun Aktif</p>
            <p className="mt-3 text-3xl font-extrabold text-emerald-400">{activeCount}</p>
          </div>
          <div className="rounded-2xl border border-zinc-900 bg-zinc-900/20 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Password View</p>
            <p className="mt-3 text-sm font-semibold text-zinc-300">Masked / Encrypted</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Daftar Akun</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Tabel ini menampilkan info username, password tersimpan, role, status, dan kontrol admin.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-900 text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="pb-3">Username</th>
                <th className="pb-3">Email</th>
                <th className="pb-3">Password</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Dibuat</th>
                <th className="pb-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/70">
              {accounts.map((account) => (
                <tr key={account.id} className="align-top text-zinc-300">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs text-zinc-400 font-bold overflow-hidden shrink-0">
                        {account.image ? (
                          <img src={account.image} alt={account.name || "Avatar"} className="h-full w-full object-cover" />
                        ) : (
                          account.name?.[0]?.toUpperCase() || "U"
                        )}
                      </span>
                      <span className="font-semibold text-white">{account.name || "Tanpa nama"}</span>
                    </div>
                  </td>
                  <td className="py-4 font-mono text-xs">{account.email}</td>
                  <td className="py-4">
                    <span className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-500">
                      Tersimpan terenkripsi
                    </span>
                  </td>
                  <td className="py-4">
                    <select
                      value={account.role}
                      disabled={roleLoadingId === account.id}
                      onChange={(e) => handleRoleChange(account.id, e.target.value as Role)}
                      className="rounded-xl border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {formatRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-4">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase ${
                        account.isActive
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                          : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {account.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="py-4 text-xs text-zinc-500">
                    {new Date(account.createdAt).toLocaleDateString("id-ID")}
                  </td>
                  <td className="py-4">
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={passwordDrafts[account.id] || ""}
                          onChange={(e) =>
                            setPasswordDrafts((prev) => ({ ...prev, [account.id]: e.target.value }))
                          }
                          placeholder="Password baru"
                          className="w-40 rounded-xl border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          disabled={passwordLoadingId === account.id}
                          onClick={() => handlePasswordReset(account.id)}
                          className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-emerald-500/40 hover:text-emerald-300"
                        >
                          {passwordLoadingId === account.id ? "Menyimpan..." : "Reset Password"}
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={statusLoadingId === account.id}
                        onClick={() => handleStatusToggle(account.id, !account.isActive)}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                          account.isActive
                            ? "bg-red-950/40 text-red-300 hover:bg-red-950/60"
                            : "bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/60"
                        }`}
                      >
                        {statusLoadingId === account.id
                          ? "Memproses..."
                          : account.isActive
                            ? "Nonaktifkan"
                            : "Aktifkan"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
