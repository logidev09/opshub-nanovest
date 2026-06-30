import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { HrRepository } from "@/features/hr/repositories/hr.repository";
import { HrDashboardClient } from "@/features/hr/components/hr-dashboard-client";
import { redirect } from "next/navigation";

export default async function HrDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role || "USER";

  const [balance, myLeaves, pendingLeaves] = await Promise.all([
    HrRepository.getLeaveBalance(userId),
    HrRepository.getLeaveRequestsByUserId(userId),
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
      <div className="border-b border-zinc-900 pb-6">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">HR AI Copilot</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Ask policies to the HR Copilot or manage your leaves.
        </p>
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
