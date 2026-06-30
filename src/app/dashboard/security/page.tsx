import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/features/shared/lib/db";
import { FeedbackPanel } from "@/features/feedback/components/feedback-panel";
import { SecuritySimulator } from "./security-simulator";

type SessionUser = {
  role?: string;
};

const secopsAutomations = [
  ["Header Audit", "Verifikasi CSP, X-Frame-Options, HSTS, dan CORS pada route penting seperti /dashboard dan /api/chat."],
  ["Prompt Defense", "Tambahkan regression test guardrail untuk prompt injection, jailbreak, dan bypass allowlist."],
  ["Connection Health", "Health check otomatis untuk database, auth, provider AI, dan API penting agar admin cepat mendeteksi gangguan."],
  ["Audit Trail", "Pastikan semua write action seperti create leave, feedback, dan finance posting menghasilkan audit log."],
];

const secopsManualChecks = [
  "Validasi role-based access ke halaman admin, HR, finance, QA, dan SecOps.",
  "Cek UI apabila koneksi database atau provider AI gagal, termasuk fallback message yang tampil ke user.",
  "Pastikan feedback security dari employee masuk ke inbox admin dan bisa di-resolve.",
  "Uji browser desktop/mobile untuk memastikan tidak ada elemen sensitif yang overlap atau bocor.",
];

export default async function SecurityPage() {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as SessionUser | undefined)?.role || "USER";

  const feedbackItems = await prisma.systemFeedback.findMany({
    where: { module: "SECOPS" },
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
            SecOps Test Matrix
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">SecOps Compliance</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Simulasi pemeriksaan keamanan, rekomendasi automasi, checklist manual, dan feedback.
          </p>
        </div>
      </div>

      <SecuritySimulator />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h3 className="mb-4 text-base font-bold text-white">Automasi SecOps yang Disarankan</h3>
          <div className="space-y-3">
            {secopsAutomations.map(([title, description]) => (
              <div key={title} className="rounded-xl border border-zinc-900 bg-zinc-950 p-4">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-900 bg-zinc-900/10 p-6">
          <h3 className="mb-4 text-base font-bold text-white">Checklist Manual Admin</h3>
          <div className="space-y-3">
            {secopsManualChecks.map((item) => (
              <div key={item} className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4 text-sm text-zinc-300">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <FeedbackPanel
        module="SECOPS"
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
