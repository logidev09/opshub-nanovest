import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { HrService } from "@/features/hr/services/hr.service";
import { chatModel, hasGroqKey } from "@/features/hr/services/ai-provider";
import {
  streamText,
  createUIMessageStreamResponse,
  createUIMessageStream,
  convertToModelMessages,
} from "ai";
import { NextResponse } from "next/server";
import { prisma } from "@/features/shared/lib/db";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Akses tidak diizinkan" }, { status: 401 });
  }

  try {
    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Pesan chat tidak ditemukan" }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    let userPrompt = "";
    if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
      userPrompt = lastMessage.parts
        .filter((part: any) => part.type === "text")
        .map((part: any) => part.text || "")
        .join(" ");
    } else {
      userPrompt = lastMessage.content || lastMessage.text || "";
    }

    // 1. Fetch Finance RAG Context
    const { context: ragContext } = await HrService.getRagContext(userPrompt, true);

    // 2. Fetch Journal Entries for Context
    const entries = await prisma.journalEntry.findMany({
      take: 15,
      orderBy: { entryDate: "desc" },
      include: {
        lines: {
          include: {
            financeAccount: {
              select: { code: true, name: true, category: true }
            }
          }
        }
      }
    });

    const formattedEntries = entries.map(e => {
      const linesStr = e.lines.map(l => `  - ${l.side}: ${l.financeAccount.code} - ${l.financeAccount.name} (${l.financeAccount.category}) Rp ${Number(l.amount).toLocaleString("id-ID")}`).join("\n");
      return `Entry ${e.reference} (${new Date(e.entryDate).toLocaleDateString("id-ID")}) - ${e.description}\n${linesStr}`;
    }).join("\n\n");

    const systemInstruction = `Anda adalah OpsHub Finance AI, asisten analis keuangan dan perpajakan profesional untuk Nanovest.
Tugas Anda adalah menganalisis data jurnal umum (*general ledger*) terbaru, memberikan rekomendasi entri jurnal, memberikan saran kepatuhan PSAK/IFRS, dan menganalisis kesehatan keuangan serta kewajiban perpajakan berdasarkan data trial balance/jurnal.

Gunakan data berikut sebagai konteks analisis Anda:

1. DOKUMEN RAG PERPAJAKAN & PSAK/IFRS (JULI 2026):
${ragContext}

2. JURNAL ENTRIES TERBARU (Membaca langsung dari database):
${formattedEntries || "Belum ada entri jurnal dalam database."}

Aturan Respons:
- Selalu jawab dalam Bahasa Indonesia secara formal, jelas, dan akurat.
- Jika pengguna bertanya tentang audit atau koreksi jurnal, ingatkan bahwa hanya Admin yang dapat mengubah/menghapus jurnal yang sudah masuk.
- Berikan analisis angka yang logis dan saran perpajakan yang solutif.`;

    if (hasGroqKey) {
      return createUIMessageStreamResponse({
        stream: createUIMessageStream({
          execute: async ({ writer }) => {
            const msgId = "assistant-" + Date.now();
            writer.write({ type: "start", messageId: msgId });
            writer.write({ type: "start-step" });
            writer.write({ type: "text-start", id: msgId });

            try {
              const result = streamText({
                model: chatModel,
                messages: [
                  { role: "system", content: systemInstruction },
                  ...convertToModelMessages(messages),
                ],
              });

              for await (const textDelta of result.textStream) {
                writer.write({ type: "text-delta", id: msgId, delta: textDelta });
              }
            } catch (err: any) {
              console.error("Groq stream error:", err);
              writer.write({ type: "text-delta", id: msgId, delta: "\n\nTerjadi kendala saat menghubungi Groq API." });
            } finally {
              writer.write({ type: "text-end", id: msgId });
              writer.write({ type: "finish-step" });
              writer.write({ type: "finish" });
            }
          }
        })
      });
    } else {
      // Mock stream for offline/unconfigured key mode
      return createUIMessageStreamResponse({
        stream: createUIMessageStream({
          execute: async ({ writer }) => {
            const msgId = "assistant-" + Date.now();
            writer.write({ type: "start", messageId: msgId });
            writer.write({ type: "start-step" });
            writer.write({ type: "text-start", id: msgId });

            const mockReply = `[MODE MOCK - GROQ API KEY BELUM DIKONFIGURASI]

Halo! Saya adalah Finance AI Nanovest. Berdasarkan analisis database jurnal umum:
- Saat ini terdeteksi **${entries.length} jurnal aktif** di database.
- RAG Context: perpajakan dan PSAK terbaru telah dimuat dari basis data.
- Rekomendasi Pajak: Pastikan potongan PPh 21 dan PPh 23 untuk transaksi vendor sudah tercatat dengan benar.
- Kesehatan Keuangan: Struktur saldo Anda seimbang (balanced).

Ada yang bisa saya bantu terkait analisis transaksi atau kesesuaian PSAK/IFRS Juli 2026?`;

            for (const word of mockReply.split(" ")) {
              writer.write({ type: "text-delta", id: msgId, delta: word + " " });
              await new Promise((resolve) => setTimeout(resolve, 35));
            }

            writer.write({ type: "text-end", id: msgId });
            writer.write({ type: "finish-step" });
            writer.write({ type: "finish" });
          }
        })
      });
    }
  } catch (error: any) {
    console.error("Finance Chat API Error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 });
  }
}
