import { createGroq } from "@ai-sdk/groq";

const groqApiKey = process.env.GROQ_API_KEY?.trim();
export const hasGroqKey =
  !!groqApiKey &&
  groqApiKey.length >= 20 &&
  !groqApiKey.includes('"') &&
  !groqApiKey.includes("'") &&
  groqApiKey.toLowerCase() !== "undefined" &&
  groqApiKey.toLowerCase() !== "null";

const groqProvider = createGroq({
  apiKey: groqApiKey || "mock-key",
});

// Using a stable Groq model (llama-3.3-70b-specdec or llama3-70b-8192)
export const chatModel = groqProvider("llama-3.3-70b-versatile");

/**
 * Returns a readable stream simulating LLM output for demonstration purposes when offline or without API keys.
 */
export function getMockStream(prompt: string, retrievedContext?: string) {
  const encoder = new TextEncoder();
  const lowerPrompt = prompt.toLowerCase();

  let responseText = "";

  if (lowerPrompt.includes("leave") || lowerPrompt.includes("cuti") || lowerPrompt.includes("libur")) {
    responseText = `Based on Nanovest's Leave Policies:
- Employees receive **12 days** of Annual Leave per year.
- Sick leaves require a valid medical certificate submitted within 48 hours.
- Maternity leave is **3 months** paid, and Paternity leave is **5 days** paid.

*Retrieved context matching:* "${retrievedContext || "Leave Policy V1.0"}"

Would you like me to draft a leave request for you? You can also use the form on the right.`;
  } else if (lowerPrompt.includes("salary") || lowerPrompt.includes("gaji") || lowerPrompt.includes("slip")) {
    responseText = `Regarding Nanovest's Payroll Policies:
- Salaries are processed and paid on the **25th of every month**.
- Payslips can be downloaded from the HR portal directly.
- Overtime must be pre-approved by your team lead.

*Retrieved context matching:* "${retrievedContext || "Payroll Guidelines"}"`;
  } else {
    responseText = `Hello! I am your Nanovest HR Copilot. I can help you with:
1. Answering questions about Nanovest HR regulations (leaves, payroll, onboarding).
2. Submitting or checking your leave requests.
3. Reviewing company policy documents.

How can I assist you today?`;
  }

  // Add guardrail / mock indicator
  responseText = `[MOCK STREAM - GROQ_API_KEY NOT CONFIGURED]\n\n${responseText}`;

  const stream = new ReadableStream({
    async start(controller) {
      // Split by words to simulate typing speed
      const words = responseText.split(" ");
      for (const word of words) {
        const chunk = word + " ";
        controller.enqueue(encoder.encode(chunk));
        // Sleep for 30-50ms
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      controller.close();
    },
  });

  return stream;
}
