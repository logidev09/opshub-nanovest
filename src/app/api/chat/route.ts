import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { checkGuardrails } from "@/features/hr/services/guardrails";
import { HrService } from "@/features/hr/services/hr.service";
import { extractLeaveIntent } from "@/features/hr/services/leave-intent";
import { chatModel, hasGroqKey } from "@/features/hr/services/ai-provider";
import {
  streamText,
  createUIMessageStreamResponse,
  createUIMessageStream,
  UIMessage,
  convertToModelMessages,
} from "ai";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/features/shared/lib/db";
import { AuditService } from "@/features/audit/services/audit.service";

interface ChatRequestPart {
  type?: string;
  text?: string;
}

interface ChatRequestMessage {
  parts?: ChatRequestPart[];
  content?: string;
  text?: string;
}

export async function POST(request: Request) {
  // 1. Session verification
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Akses tidak diizinkan" }, { status: 401 });
  }

  try {
    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Pesan chat tidak ditemukan" }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1] as ChatRequestMessage;
    // Extract user prompt - handle all AI SDK message formats
    let userPrompt = "";
    // v7 format: parts array with {type: "text", text: "..."}
    if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
      userPrompt = lastMessage.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text || "")
        .join("");
    }
    // v4 format: content as string
    if (!userPrompt && typeof lastMessage.content === "string") {
      userPrompt = lastMessage.content;
    }
    // Fallback: try text field directly
    if (!userPrompt && typeof lastMessage.text === "string") {
      userPrompt = lastMessage.text;
    }
    userPrompt = userPrompt.trim();
    if (!userPrompt) {
      return NextResponse.json({ error: "Pertanyaan pengguna tidak ditemukan" }, { status: 400 });
    }

    // 2. Guardrails validation
    const guardrailResult = await checkGuardrails(userPrompt);
    if (!guardrailResult.passed) {
      return NextResponse.json(
        {
          error: guardrailResult.reason,
          layer: guardrailResult.layer,
          category: guardrailResult.category,
        },
        { status: 400 }
      );
    }

    const sessionUser = session.user as { id: string; name?: string | null; role?: string };

    // Chatbot command execution for HR & ADMIN: Approve/Reject Leaves (Task 11)
    if (sessionUser.role === "HR" || sessionUser.role === "ADMIN") {
      const isApproveCommand = /setujui\s+semua|terima\s+semua|approve\s+all/i.test(userPrompt);
      const isRejectCommand = /tolak\s+semua|reject\s+all/i.test(userPrompt);

      if (isApproveCommand || isRejectCommand) {
        try {
          const targetStatus = isApproveCommand ? "APPROVED" : "REJECTED";
          const pendingLeaves = await prisma.leaveRequest.findMany({
            where: { status: "PENDING" },
            include: { user: { select: { name: true } } }
          });

          if (pendingLeaves.length === 0) {
            return createStreamFromPlainText(
              "Halo! Saat ini tidak ada pengajuan cuti karyawan berstatus PENDING untuk diproses.",
              "leave-action-none-" + Date.now()
            );
          }

          await prisma.leaveRequest.updateMany({
            where: { status: "PENDING" },
            data: {
              status: targetStatus,
              approvedBy: sessionUser.id,
              approvedAt: new Date()
            }
          });

          for (const req of pendingLeaves) {
            await AuditService.log({
              userId: sessionUser.id,
              action: isApproveCommand ? "APPROVE_LEAVE" : "REJECT_LEAVE",
              entity: "LeaveRequest",
              entityId: req.id,
              oldValue: { status: "PENDING" },
              newValue: { status: targetStatus }
            });
          }

          revalidatePath("/dashboard");
          revalidatePath("/dashboard/hr");

          const count = pendingLeaves.length;
          const statusText = isApproveCommand ? "disetujui" : "ditolak";
          const listNames = pendingLeaves.map(l => l.user.name).join(", ");
          
          return createStreamFromPlainText(
            `[SYSTEM ACTION] Berhasil melakukan pemrosesan otomatis. Sebanyak ${count} pengajuan cuti dari (${listNames}) telah berhasil ${statusText}.`,
            "leave-action-success-" + Date.now()
          );
        } catch (err: any) {
          return createStreamFromPlainText(
            `Gagal memproses aksi persetujuan massal. Detail: ${err.message || err}`,
            "leave-action-error-" + Date.now()
          );
        }
      }

      // Check specific employee leave approval/rejection command (e.g. "setujui cuti Budi")
      const approveSpecificMatch = userPrompt.match(/(?:setujui|terima)\s+cuti\s+([a-zA-Z\s]+)/i);
      const rejectSpecificMatch = userPrompt.match(/(?:tolak|reject)\s+cuti\s+([a-zA-Z\s]+)/i);

      if (approveSpecificMatch || rejectSpecificMatch) {
        const namePart = (approveSpecificMatch ? approveSpecificMatch[1] : rejectSpecificMatch![1]).trim();
        if (namePart && namePart.length > 2) {
          try {
            const targetStatus = approveSpecificMatch ? "APPROVED" : "REJECTED";
            
            // Find users matching name
            const matchingUsers = await prisma.user.findMany({
              where: { name: { contains: namePart, mode: "insensitive" } }
            });

            if (matchingUsers.length === 0) {
              return createStreamFromPlainText(
                `Saya tidak menemukan karyawan dengan nama yang cocok dengan "${namePart}".`,
                "leave-specific-notfound-" + Date.now()
              );
            }

            const userIds = matchingUsers.map(u => u.id);
            const pendingLeaves = await prisma.leaveRequest.findMany({
              where: { userId: { in: userIds }, status: "PENDING" },
              include: { user: { select: { name: true } } }
            });

            if (pendingLeaves.length === 0) {
              const matchedNames = matchingUsers.map(u => u.name).join(", ");
              return createStreamFromPlainText(
                `Ditemukan karyawan (${matchedNames}), tetapi tidak ada pengajuan cuti aktif yang berstatus PENDING.`,
                "leave-specific-pending-none-" + Date.now()
              );
            }

            await prisma.leaveRequest.updateMany({
              where: { id: { in: pendingLeaves.map(l => l.id) } },
              data: {
                status: targetStatus,
                approvedBy: sessionUser.id,
                approvedAt: new Date()
              }
            });

            for (const req of pendingLeaves) {
              await AuditService.log({
                userId: sessionUser.id,
                action: approveSpecificMatch ? "APPROVE_LEAVE" : "REJECT_LEAVE",
                entity: "LeaveRequest",
                entityId: req.id,
                oldValue: { status: "PENDING" },
                newValue: { status: targetStatus }
              });
            }

            revalidatePath("/dashboard");
            revalidatePath("/dashboard/hr");

            const matchedEmployeeName = pendingLeaves[0].user.name;
            const actionText = approveSpecificMatch ? "disetujui" : "ditolak";
            return createStreamFromPlainText(
              `[SYSTEM ACTION] Pengajuan cuti untuk karyawan "${matchedEmployeeName}" berhasil ${actionText} secara otomatis.`,
              "leave-specific-success-" + Date.now()
            );
          } catch (err: any) {
            return createStreamFromPlainText(
              `Gagal memproses aksi persetujuan. Detail: ${err.message || err}`,
              "leave-specific-error-" + Date.now()
            );
          }
        }
      }
    }

    const autoLeaveIntent = extractLeaveIntent(userPrompt);
    if (autoLeaveIntent) {
      try {
        await HrService.requestLeave(sessionUser.id, autoLeaveIntent);
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/hr");

        const confirmationText = [
          `Siap, pengajuan cuti Anda sudah otomatis saya kirim ke HR.`,
          `Jenis cuti: ${formatLeaveType(autoLeaveIntent.type)}.`,
          `Periode: ${formatDisplayDate(autoLeaveIntent.startDate)} sampai ${formatDisplayDate(autoLeaveIntent.endDate)}.`,
          autoLeaveIntent.reason ? `Alasan: ${autoLeaveIntent.reason}.` : "Alasan belum dicantumkan secara spesifik.",
          "Silakan cek panel riwayat cuti di sebelah kanan untuk memastikan statusnya sudah masuk sebagai pending.",
        ].join("\n");

        return createStreamFromPlainText(confirmationText, "leave-" + Date.now());
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Pengajuan cuti belum bisa diproses otomatis saat ini.";

        return createStreamFromPlainText(
          `Saya mendeteksi Anda ingin mengajukan cuti, tetapi pengajuan otomatis gagal diproses.\n\nDetail: ${message}\n\nSilakan lengkapi lewat formulir cuti di panel kanan atau kirim ulang dengan format tanggal yang lebih jelas.`,
          "leave-error-" + Date.now()
        );
      }
    }

    // 3. RAG context query
    const { context, matchedCount } = await HrService.getRagContext(userPrompt);

    const mockText = getMockResponseText(userPrompt, matchedCount);

    // 4. Stream response using AI SDK v7 UIMessageStream protocol
    if (hasGroqKey) {
      const systemInstruction = `Anda adalah OpsHub HR Copilot, asisten sumber daya manusia yang profesional dan membantu untuk Nanovest.
Tujuan Anda adalah menjawab pertanyaan kebijakan perusahaan secara akurat HANYA berdasarkan konteks kebijakan yang diambil di bawah ini.
Selalu jawab dalam Bahasa Indonesia, kecuali pengguna secara eksplisit meminta bahasa lain.
Jika konteks yang diambil tidak memuat jawabannya, sampaikan dengan sopan bahwa informasi tersebut belum tersedia dan sarankan pengguna menghubungi tim HR.
Jaga jawaban tetap jelas, ringkas, membantu, dan profesional.

RETRIEVED POLICY CONTEXT (Matched: ${matchedCount} documents):
${context}`;

      return createUIMessageStreamResponse({
        stream: createUIMessageStream({
          execute: async ({ writer }) => {
            const msgId = "assistant-" + Date.now();
            let wroteModelText = false;
            const streamMockFallback = async () => {
              for (const word of mockText.split(" ")) {
                writer.write({ type: "text-delta", id: msgId, delta: word + " " });
                await new Promise((resolve) => setTimeout(resolve, 30));
              }
            };

            writer.write({ type: "start", messageId: msgId });
            writer.write({ type: "start-step" });
            writer.write({ type: "text-start", id: msgId });

            try {
              const result = streamText({
                model: chatModel,
                messages: [
                  { role: "system", content: systemInstruction },
                  ...(await convertToModelMessages(messages as UIMessage[])),
                ],
              });

              for await (const delta of result.textStream) {
                if (!delta) continue;
                wroteModelText = true;
                writer.write({ type: "text-delta", id: msgId, delta });
              }
            } catch (error) {
              console.error("[ChatAPI] StreamText error, falling back to mock response:", error);

              if (!wroteModelText) {
                await streamMockFallback();
              } else {
                writer.write({
                  type: "text-delta",
                  id: msgId,
                  delta: "\n\nSaya mengalami kendala sementara saat menyelesaikan jawaban ini. Silakan kirim ulang pertanyaan jika Anda membutuhkan detail tambahan.",
                });
              }
            }

            // Some provider failures complete the stream without throwing and without text.
            if (!wroteModelText) {
              await streamMockFallback();
            }

            writer.write({ type: "text-end", id: msgId });
            writer.write({ type: "finish-step" });
            writer.write({ type: "finish" });
          },
        }),
      });
    } else {
      // API Key missing - fallback to mock UIMessageStream
      const msgId = "mock-" + Date.now();

      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({ type: "start", messageId: msgId });
          writer.write({ type: "start-step" });
          writer.write({ type: "text-start", id: msgId });

          // Simulate word-by-word streaming
          const words = mockText.split(" ");
          for (const word of words) {
            writer.write({ type: "text-delta", id: msgId, delta: word + " " });
            await new Promise((resolve) => setTimeout(resolve, 30));
          }

          writer.write({ type: "text-end", id: msgId });
          writer.write({ type: "finish-step" });
          writer.write({ type: "finish" });
        },
      });

      return createUIMessageStreamResponse({ stream });
    }
  } catch (error: unknown) {
    console.error("[ChatAPI] Error during chat processing:", error);
    return NextResponse.json(
      {
        error: "HR Copilot mengalami kesalahan server yang tidak terduga. Silakan coba lagi.",
      },
      { status: 500 }
    );
  }
}

function createStreamFromPlainText(text: string, messageId: string) {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageId });
      writer.write({ type: "start-step" });
      writer.write({ type: "text-start", id: messageId });

      for (const chunk of text.split(" ")) {
        writer.write({ type: "text-delta", id: messageId, delta: chunk + " " });
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      writer.write({ type: "text-end", id: messageId });
      writer.write({ type: "finish-step" });
      writer.write({ type: "finish" });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

function formatDisplayDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatLeaveType(type: string) {
  switch (type) {
    case "SICK":
      return "Cuti Sakit";
    case "MATERNITY":
      return "Cuti Melahirkan";
    case "PATERNITY":
      return "Cuti Ayah";
    case "UNPAID":
      return "Cuti di Luar Tanggungan";
    default:
      return "Cuti Tahunan";
  }
}

/** Generate mock response text based on prompt keywords */
function getMockResponseText(prompt: string, matchedCount: number): string {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes("leave") || lowerPrompt.includes("cuti") || lowerPrompt.includes("libur")) {
    return `Berdasarkan kebijakan cuti Nanovest:
- Karyawan mendapatkan **12 hari** cuti tahunan setiap tahun.
- Cuti sakit memerlukan surat keterangan dokter yang dikirim maksimal 48 jam setelah pengajuan.
- Cuti melahirkan diberikan selama **3 bulan** dengan gaji penuh, dan cuti ayah selama **5 hari** dengan gaji penuh.

*Kebijakan yang cocok: ${matchedCount}*

Apakah Anda ingin saya bantu menyusun pengajuan cuti? Anda juga bisa langsung memakai formulir di sebelah kanan.`;
  } else if (lowerPrompt.includes("salary") || lowerPrompt.includes("gaji") || lowerPrompt.includes("slip")) {
    return `Terkait kebijakan payroll Nanovest:
- Gaji diproses dan dibayarkan setiap tanggal **25 setiap bulan**.
- Slip gaji dapat diunduh langsung melalui portal HR.
- Lembur harus mendapat persetujuan terlebih dahulu dari atasan tim.

*Kebijakan yang cocok: ${matchedCount}*`;
  } else {
    return `Halo, saya HR Copilot Nanovest. Saya dapat membantu Anda untuk:
1. Menjawab pertanyaan tentang kebijakan HR Nanovest, seperti cuti, payroll, dan onboarding.
2. Membantu pengajuan atau pengecekan status cuti.
3. Meninjau informasi kebijakan perusahaan yang tersedia.

*Kebijakan yang cocok: ${matchedCount}*

Apa yang ingin Anda tanyakan hari ini?`;
  }
}
