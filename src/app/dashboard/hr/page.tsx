import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { HrRepository } from "@/features/hr/repositories/hr.repository";
import { HrDashboardClient } from "@/features/hr/components/hr-dashboard-client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/features/shared/lib/db";

type SessionUser = {
  id: string;
  role?: string;
};

export default async function HrDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  const sessionUser = session.user as SessionUser;
  const userId = sessionUser.id;
  const userRole = sessionUser.role || "USER";

  const [balance, myLeaves, pendingLeaves] = await Promise.all([
    HrRepository.getLeaveBalance(userId),
    userRole === "ADMIN" || userRole === "HR"
      ? prisma.leaveRequest.findMany({
          include: {
            user: {
              select: {
                name: true,
                email: true,
                image: true,
              },
  // NOTE: If division is required, we check it here, but HR Copilot is for everyone (or HR/Admin).
  // The user requested: HR Copilot (hanya employee hr dan admin)
  if (sessionUser.role !== "ADMIN" && sessionUser.role !== "HR") {
    redirect("/dashboard");
  }

  const pendingLeavesRaw = await HrRepository.getLeaveRequestsPending();
  const pendingLeavesSerialized = pendingLeavesRaw.map((l) => ({
    id: l.id,
    type: l.type,
    startDate: l.startDate.toISOString(),
    endDate: l.endDate.toISOString(),
    reason: l.reason,
    status: l.status,
    userId: l.userId,
    createdAt: l.createdAt.toISOString(),
    approvedAt: l.approvedAt ? l.approvedAt.toISOString() : null,
    user: {
      name: l.user.name,
      email: l.user.email,
      image: (l.user as any).image || null,
    },
  }));

  const allLeavesRaw =
    sessionUser.role === "ADMIN" || sessionUser.role === "HR"
      ? await prisma.leaveRequest.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
          include: {
            user: { select: { name: true, email: true } },
          },
        })
      : await HrRepository.getLeaveRequestsByUserId(sessionUser.id!);

  const allLeavesSerialized = allLeavesRaw.map((l) => ({
    id: l.id,
    type: l.type,
    startDate: l.startDate.toISOString(),
    endDate: l.endDate.toISOString(),
    reason: l.reason,
    status: l.status,
    userId: l.userId,
    createdAt: l.createdAt.toISOString(),
    approvedAt: l.approvedAt ? l.approvedAt.toISOString() : null,
    user: "user" in l ? { name: (l as any).user.name } : { name: sessionUser.name },
  }));

  const leaveBalance = await HrRepository.getLeaveBalance(sessionUser.id!);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">HR AI Copilot</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Tanyakan kebijakan ke HR Copilot atau kelola pengajuan cuti Anda.
          </p>
        </div>
        {(sessionUser.role === "HR" || sessionUser.role === "ADMIN") && (
          <div>
            <Link
              href="/dashboard/hr/policies"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-emerald-400 active:scale-95 w-max"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v2m0 2v8m-4-4h8"
                />
              </svg>
              Kelola Dokumen RAG
            </Link>
          </div>
        )}
      </div>

      <HrDashboardClient
        userId={userId}
        userRole={userRole}
        initialBalance={balance}
        initialMyLeaves={myLeavesSerialized}
        initialPendingLeaves={pendingLeavesSerialized}
      />
    </div>
  );
}
