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
    responseText = `Berdasarkan kebijakan cuti Nanovest:
- Karyawan mendapatkan **12 hari** cuti tahunan setiap tahun.
- Cuti sakit memerlukan surat keterangan dokter yang dikirim maksimal 48 jam setelah pengajuan.
- Cuti melahirkan diberikan selama **3 bulan** dengan gaji penuh, dan cuti ayah selama **5 hari** dengan gaji penuh.

*Konteks yang cocok:* "${retrievedContext || "Kebijakan Cuti V1.0"}"

Apakah Anda ingin saya bantu menyusun pengajuan cuti? Anda juga bisa langsung memakai formulir di sebelah kanan.`;
  } else if (lowerPrompt.includes("salary") || lowerPrompt.includes("gaji") || lowerPrompt.includes("slip")) {
    responseText = `Terkait kebijakan payroll Nanovest:
- Gaji diproses dan dibayarkan setiap tanggal **25 setiap bulan**.
- Slip gaji dapat diunduh langsung melalui portal HR.
- Lembur harus mendapat persetujuan terlebih dahulu dari atasan tim.

*Konteks yang cocok:* "${retrievedContext || "Panduan Payroll"}"`;
  } else {
    responseText = `Halo, saya HR Copilot Nanovest. Saya dapat membantu Anda untuk:
1. Menjawab pertanyaan tentang kebijakan HR Nanovest, seperti cuti, payroll, dan onboarding.
2. Membantu pengajuan atau pengecekan status cuti.
3. Meninjau informasi kebijakan perusahaan yang tersedia.

Apa yang ingin Anda tanyakan hari ini?`;
  }

  // Add guardrail / mock indicator
  responseText = `[MODE MOCK - GROQ_API_KEY BELUM DIKONFIGURASI]\n\n${responseText}`;

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
