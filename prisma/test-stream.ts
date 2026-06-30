import { createUIMessageStream } from "ai";

async function main() {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const msgId = "mock-msg-" + Date.now();
      
      writer.write({ type: "start", messageId: msgId });
      writer.write({ type: "text-start", id: msgId });

      const text = "Hello World! This is a mock streaming response from Nanovest HR Copilot.";
      const words = text.split(" ");
      for (const word of words) {
        writer.write({ type: "text-delta", id: msgId, delta: word + " " });
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      writer.write({ type: "text-end", id: msgId });
      writer.write({ type: "finish-step" });
      writer.write({ type: "finish" });
    },
  });

  const reader = stream.getReader();
  let i = 0;
  while (i < 30) {
    const { done, value } = await reader.read();
    if (done) break;
    console.log(`Chunk ${i}:`, JSON.stringify(value));
    i++;
  }
  console.log("DONE - stream closed");
}

main().catch(console.error);
