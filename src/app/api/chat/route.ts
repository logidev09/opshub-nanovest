import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { checkGuardrails } from "@/features/hr/services/guardrails";
import { HrService } from "@/features/hr/services/hr.service";
import { chatModel, hasGroqKey } from "@/features/hr/services/ai-provider";
import {
  streamText,
  createUIMessageStreamResponse,
  toUIMessageStream,
  createUIMessageStream,
  UIMessage,
  convertToModelMessages,
} from "ai";
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

    // 4. Stream response using AI SDK v7 UIMessageStream protocol
    if (hasGroqKey) {
      const systemInstruction = `You are OpsHub HR Copilot, a professional and helpful human resources assistant for Nanovest.
Your goal is to answer company policy questions accurately based ONLY on the retrieved policy context provided below.
If the retrieved context does not contain the answer, politely state that you do not have that information and suggest contacting the HR team.
Keep your answers clear, concise, and helpful. Always refer to policies professionally.

RETRIEVED POLICY CONTEXT (Matched: ${matchedCount} documents):
${context}`;

      const result = streamText({
        model: chatModel,
        messages: [
          { role: "system", content: systemInstruction },
          ...(await convertToModelMessages(messages as UIMessage[])),
        ],
      });

      return createUIMessageStreamResponse({
        stream: toUIMessageStream({ stream: result.stream }),
      });
    } else {
      // API Key missing - fallback to mock UIMessageStream
      const mockText = getMockResponseText(userPrompt, matchedCount);
      const msgId = "mock-" + Date.now();

      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({ type: "start", messageId: msgId });
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
  } catch (error: any) {
    console.error("[ChatAPI] Error during chat processing:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

/** Generate mock response text based on prompt keywords */
function getMockResponseText(prompt: string, matchedCount: number): string {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes("leave") || lowerPrompt.includes("cuti") || lowerPrompt.includes("libur")) {
    return `Based on Nanovest's Leave Policies:
- Employees receive **12 days** of Annual Leave per year.
- Sick leaves require a valid medical certificate submitted within 48 hours.
- Maternity leave is **3 months** paid, and Paternity leave is **5 days** paid.

*Policies matched: ${matchedCount}*

Would you like me to draft a leave request for you? You can also use the form on the right.`;
  } else if (lowerPrompt.includes("salary") || lowerPrompt.includes("gaji") || lowerPrompt.includes("slip")) {
    return `Regarding Nanovest's Payroll Policies:
- Salaries are processed and paid on the **25th of every month**.
- Payslips can be downloaded from the HR portal directly.
- Overtime must be pre-approved by your team lead.

*Policies matched: ${matchedCount}*`;
  } else {
    return `Hello! I am your Nanovest HR Copilot. I can help you with:
1. Answering questions about Nanovest HR regulations (leaves, payroll, onboarding).
2. Submitting or checking your leave requests.
3. Reviewing company policy documents.

*Policies matched: ${matchedCount}*

How can I assist you today?`;
  }
}
