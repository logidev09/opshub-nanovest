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
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : HrRepository.getLeaveRequestsByUserId(userId),
    userRole === "ADMIN" || userRole === "HR"
      ? HrRepository.getLeaveRequestsPending()
      : Promise.resolve([]),
  ]);

  // Convert Date objects to strings to prevent serialization errors between Server and Client boundaries
  const myLeavesSerialized = myLeaves.map((l) => ({
    id: l.id,
    userId: l.userId,
    type: l.type,
    startDate: l.startDate.toISOString(),
    endDate: l.endDate.toISOString(),
    reason: l.reason,
    status: l.status,
    approvedBy: l.approvedBy,
    approvedAt: l.approvedAt?.toISOString() || null,
    createdAt: l.createdAt.toISOString(),
    userName: "user" in l ? (l.user as any)?.name : null,
    userEmail: "user" in l ? (l.user as any)?.email : null,
  }));

  const pendingLeavesSerialized = pendingLeaves.map((l) => ({
    id: l.id,
    userId: l.userId,
    type: l.type,
    startDate: l.startDate.toISOString(),
    endDate: l.endDate.toISOString(),
    reason: l.reason,
    status: l.status,
    approvedBy: l.approvedBy,
    approvedAt: l.approvedAt?.toISOString() || null,
    createdAt: l.createdAt.toISOString(),
    user: {
      name: l.user.name,
      email: l.user.email,
    },
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">HR AI Copilot</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Tanyakan kebijakan ke HR Copilot atau kelola pengajuan cuti Anda.
          </p>
        </div>
        {(userRole === "HR" || userRole === "ADMIN") && (
          <div>
            <Link
              href="/dashboard/hr/policies"
              className="inline-flex px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition duration-150 items-center gap-1.5 shadow-lg shadow-emerald-500/10"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
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
