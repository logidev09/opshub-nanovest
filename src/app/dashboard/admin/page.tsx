import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/features/shared/lib/db";
import { AdminAccountsClient } from "@/features/admin/components/admin-accounts-client";

type SessionUser = {
  role?: string;
};

export default async function AdminAccountsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/");
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const accounts = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      image: true,
      division: true,
      password: true,
    },
  });

  return (
    <div className="space-y-8">
      <div className="border-b border-zinc-900 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Admin Account Center</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Kelola akun employee, HR, dan admin dari satu panel terpusat.
        </p>
      </div>

      <AdminAccountsClient
        accounts={accounts.map((account) => ({
          ...account,
          createdAt: account.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
