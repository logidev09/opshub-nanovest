import { generateText } from "ai";
import { chatModel, hasGroqKey } from "../src/features/hr/services/ai-provider";

async function testGroq() {
  console.log("hasGroqKey:", hasGroqKey);
  console.log("GROQ_API_KEY environment value starts with:", process.env.GROQ_API_KEY ? process.env.GROQ_API_KEY.substring(0, 7) + "..." : "undefined");

  if (!process.env.GROQ_API_KEY) {
    console.log("No Groq API Key found. Skipping Groq call.");
    return;
  }

  try {
    console.log("Sending query to Groq Llama 3.3 model...");
    const result = await generateText({
      model: chatModel,
      prompt: "Hello, reply with only the word SUCCESS.",
    });

    console.log("Response from Groq:", result.text);
  } catch (e: any) {
    console.error("Groq API Call Failed with error:", e.message || e);
  }
}

testGroq();
