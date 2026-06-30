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

    const sessionUser = session.user as { id: string; name?: string | null };
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
