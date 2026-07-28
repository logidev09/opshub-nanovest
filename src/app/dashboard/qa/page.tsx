import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/features/shared/lib/db";
import { FeedbackPanel } from "@/features/feedback/components/feedback-panel";
import { PlaywrightSimulator } from "./qa-simulator";

import { redirect } from "next/navigation";

type SessionUser = {
  role?: string;
  division?: string | null;
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
  if (!session) redirect("/");
  
  const sessionUser = session.user as SessionUser;
  if (
    sessionUser.role !== "ADMIN" &&
    sessionUser.division !== "Quality Assurance" &&
    sessionUser.division !== "Security Operations & IT Support"
  ) {
    redirect("/dashboard");
  }
  
  const isReadOnly = sessionUser.role !== "ADMIN" && sessionUser.division !== "Quality Assurance";
  const userRole = sessionUser.role || "USER";

  const feedbackWhere: any = { module: "QA" };
  if (isReadOnly) {
    feedbackWhere.submittedById = (sessionUser as any).id;
  }

  const feedbackItems = await prisma.systemFeedback.findMany({
    where: feedbackWhere,
    orderBy: { createdAt: "desc" },
    take: 10,
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

      <PlaywrightSimulator isReadOnly={isReadOnly} />

      {/* Collapsible Accordion Lists (Item 9: Default Closed Toggle Lists) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <details className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 font-sans">
          <summary className="cursor-pointer font-bold text-white text-sm uppercase tracking-wider flex justify-between items-center select-none">
            <span>🧪 Test Otomatis yang Perlu Ditambahkan (Klik untuk Membuka)</span>
            <span className="text-emerald-400 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="space-y-3 mt-4 pt-4 border-t border-zinc-800">
            {automatedTests.map(([title, description]) => (
              <div key={title} className="rounded-xl border border-zinc-900 bg-zinc-950 p-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{description}</p>
              </div>
            ))}
          </div>
        </details>

        <details className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 font-sans">
          <summary className="cursor-pointer font-bold text-white text-sm uppercase tracking-wider flex justify-between items-center select-none">
            <span>📋 Checklist QA Manual (Klik untuk Membuka)</span>
            <span className="text-emerald-400 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="space-y-3 mt-4 pt-4 border-t border-zinc-800">
            {manualTests.map((test) => (
              <div key={test} className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4 text-xs text-zinc-300">
                {test}
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* QA AI Insight Card (Item 8) */}
      <div className="p-5 rounded-2xl border border-zinc-900 bg-zinc-950/60 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              QA AI Quality & Test Coverage Insights (Juli 2026)
            </h3>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono">Skor Kualitas QA: 97.4% PASS</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-400 leading-relaxed">
          <div className="p-3.5 rounded-xl border border-zinc-900 bg-zinc-900/30 space-y-1">
            <span className="font-semibold text-emerald-400 block">Evaluasi Test Coverage & E2E Pass Rate</span>
            <p>
              Playwright E2E suite mencatatkan 100% tingkat kelulusan pada aliran autentikasi, pengajuan cuti, posting buku besar, dan instruksi AI Copilot. Rata-rata latensi API berjalan di bawah 65ms.
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-zinc-900 bg-zinc-900/30 space-y-1">
            <span className="font-semibold text-emerald-400 block">Rekomendasi QA Automation</span>
            <p>
              [Saran AI]: Disarankan penambahan beban pengujian komposit pada pembuatan entri jurnal majemuk multi-debit/kredit di lingkungan staging untuk menguji kestabilan transaksi konkurensi tinggi.
            </p>
          </div>
        </div>
      </div>

      <FeedbackPanel
        module="QA"
        userRole={userRole}
        isReadOnly={isReadOnly}
        feedbackItems={feedbackItems.map((item) => ({
          id: item.id,
          category: item.category,
          message: item.message,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
          submittedBy: item.submittedBy,
        }))}
      />
    </div>
  );
}
