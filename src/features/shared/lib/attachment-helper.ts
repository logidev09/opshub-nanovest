export interface AttachmentItem {
  name: string;
  data: string; // base64 string
}

export function parseAttachments(fullText: string): { text: string; attachments: AttachmentItem[] } {
  if (!fullText) return { text: "", attachments: [] };
  const marker = "---ATTACHMENT_START---";
  if (!fullText.includes(marker)) {
    return { text: fullText, attachments: [] };
  }

  const parts = fullText.split(marker);
  const text = parts[0].trim();
  const rest = parts[1] || "";
  const endParts = rest.split("---ATTACHMENT_END---")[0] || "";

  if (endParts.includes("FILES:")) {
    try {
      const jsonStr = endParts.split("FILES:")[1].trim();
      const files = JSON.parse(jsonStr);
      if (Array.isArray(files)) {
        return { text, attachments: files };
      }
    } catch (e) {
      console.error("Error parsing multi-file attachments JSON:", e);
    }
  }

  // Fallback single attachment format
  const nameMatch = endParts.match(/NAME:\s*(.*?)\n/);
  const dataClean = endParts.split("DATA:")[1]?.trim() || "";
  const nameClean = nameMatch ? nameMatch[1].trim() : "Attachment";
  if (dataClean) {
    return { text, attachments: [{ name: nameClean, data: dataClean }] };
  }

  return { text, attachments: [] };
}

export function formatAttachmentsMessage(text: string, files: AttachmentItem[]): string {
  const cleanText = text.trim();
  if (!files || files.length === 0) return cleanText;
  const filesJson = JSON.stringify(files);
  return `${cleanText}\n\n---ATTACHMENT_START---\nFILES: ${filesJson}\n---ATTACHMENT_END---`;
}
