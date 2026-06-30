import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { checkGuardrails } from "@/features/hr/services/guardrails";
import { HrService } from "@/features/hr/services/hr.service";
import { chatModel, getMockStream, hasGroqKey } from "@/features/hr/services/ai-provider";
import { streamText } from "ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // 1. Session verification
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Missing chat messages" }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    let userPrompt = "";
    if (typeof lastMessage.content === "string" && lastMessage.content) {
      userPrompt = lastMessage.content;
    } else if (lastMessage.parts && Array.isArray(lastMessage.parts)) {
      userPrompt = lastMessage.parts
        .map((part: any) => (part.type === "text" ? part.text : ""))
        .join("");
    }

    // 2. Guardrails validation
    const guardrailResult = await checkGuardrails(userPrompt);
    if (!guardrailResult.passed) {
      return NextResponse.json(
        { error: guardrailResult.reason, layer: guardrailResult.layer },
        { status: 400 }
      );
    }

    // 3. RAG context query
    const { context, matchedCount } = await HrService.getRagContext(userPrompt);

    // 4. Stream response
    if (hasGroqKey) {
      const systemInstruction = `You are OpsHub HR Copilot, a professional and helpful human resources assistant for Nanovest.
Your goal is to answer company policy questions accurately based ONLY on the retrieved policy context provided below.
If the retrieved context does not contain the answer, politely state that you do not have that information and suggest contacting the HR team.
Keep your answers clear, concise, and helpful. Always refer to policies professionally.

RETRIEVED POLICY CONTEXT (Matched: ${matchedCount} documents):
${context}`;

      const result = await streamText({
        model: chatModel,
        messages: [
          { role: "system", content: systemInstruction },
          ...messages,
        ],
      });

      return result.toTextStreamResponse();
    } else {
      // API Key missing - fallback to typing-simulated mock stream
      const mockStream = getMockStream(userPrompt, `Policies matched: ${matchedCount}`);
      return new Response(mockStream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
        },
      });
    }
  } catch (error: any) {
    console.error("[ChatAPI] Error during chat processing:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
