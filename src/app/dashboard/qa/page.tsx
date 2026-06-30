import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/features/shared/lib/db";
import { FeedbackPanel } from "@/features/feedback/components/feedback-panel";
import { PlaywrightSimulator } from "./qa-simulator";

type SessionUser = {
  role?: string;
};

const automatedTests = [
  ["Playwright UI", "Login valid/invalid, chat send flow, auto-submit leave via AI, admin account management"],
  ["API Contract", "POST /api/chat, auth callback, feedback submission, finance posting action"],
  ["Regression", "Tanggal kalender, avatar kiri/kanan chat, status leave pending, role-based navigation"],
  ["Performance", "Latency chat, query ledger snapshot, audit log rendering, feedback inbox load"],
];

const manualTests = [
  "Uji employee mengirim feedback QA dan pastikan admin menerima item baru di inbox.",
  "Uji admin mengubah status feedback dari OPEN ke IN_REVIEW dan RESOLVED.",
  "Uji visual date picker, alignment bubble AI/user, dan role label di sidebar.",
  "Uji akses role: employee tidak boleh melihat halaman admin account center.",
];

export default async function QaLabPage() {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as SessionUser | undefined)?.role || "USER";

  const feedbackItems = await prisma.systemFeedback.findMany({
    where: { module: "QA" },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      submittedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-zinc-900 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            QA Execution Plan
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">QA Automated Lab</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Simulasi test otomatis, rekomendasi test, checklist manual, dan feedback user.
          </p>
        </div>
      </div>

      <PlaywrightSimulator />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h3 className="mb-4 text-base font-bold text-white">Test Otomatis yang Perlu Ditambahkan</h3>
          <div className="space-y-3">
            {automatedTests.map(([title, description]) => (
              <div key={title} className="rounded-xl border border-zinc-900 bg-zinc-950 p-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6">
          <h3 className="mb-4 text-base font-bold text-white">Checklist QA Manual</h3>
          <div className="space-y-3">
            {manualTests.map((test) => (
              <div key={test} className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4 text-sm text-zinc-300">
                {test}
              </div>
            ))}
          </div>
        </div>
      </div>

      <FeedbackPanel
        module="QA"
        userRole={userRole}
        feedbackItems={feedbackItems.map((item) => ({
          id: item.id,
          category: item.category,
          message: item.message,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
          submittedBy: item.submittedBy,
        }))}
      />
    </div>
  );
}
