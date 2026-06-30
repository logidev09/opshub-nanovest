import { LeaveType } from "@prisma/client";

interface ParsedLeaveIntent {
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
  confidence: "high" | "medium";
}

const AUTO_SUBMIT_PATTERNS = [
  /\b(ajukan|ajukanin|buatkan|submit|kirimkan|request|tolong buatkan)\b.*\b(cuti|izin)\b/i,
  /\b(saya|aku)\s+(ingin|mau)\s+(cuti|izin)\b/i,
  /\b(cuti|izin)\b.*\b(besok|lusa|hari ini|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/i,
];

const DATE_RANGE_PATTERN =
  /\b(?:dari|mulai|tanggal)?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|hari ini|besok|lusa)\s*(?:sampai|hingga|-|sd)\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|hari ini|besok|lusa)\b/i;

const SINGLE_DATE_PATTERN =
  /\b(?:tanggal|pada)?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|hari ini|besok|lusa)\b/i;

export function extractLeaveIntent(prompt: string): ParsedLeaveIntent | null {
  if (!AUTO_SUBMIT_PATTERNS.some((pattern) => pattern.test(prompt))) {
    return null;
  }

  const normalized = prompt.toLowerCase();
  const type = detectLeaveType(normalized);
  const rangeMatch = prompt.match(DATE_RANGE_PATTERN);

  if (rangeMatch) {
    const startDate = parseFlexibleDate(rangeMatch[1]);
    const endDate = parseFlexibleDate(rangeMatch[2]);

    if (startDate && endDate) {
      return {
        type,
        startDate,
        endDate,
        reason: extractReason(prompt),
        confidence: "high",
      };
    }
  }

  const singleDateMatch = prompt.match(SINGLE_DATE_PATTERN);
  if (singleDateMatch) {
    const singleDate = parseFlexibleDate(singleDateMatch[1]);
    if (singleDate) {
      return {
        type,
        startDate: singleDate,
        endDate: singleDate,
        reason: extractReason(prompt),
        confidence: "medium",
      };
    }
  }

  return null;
}

function detectLeaveType(text: string): LeaveType {
  if (text.includes("sakit")) return LeaveType.SICK;
  if (text.includes("melahirkan")) return LeaveType.MATERNITY;
  if (text.includes("ayah")) return LeaveType.PATERNITY;
  if (text.includes("unpaid") || text.includes("di luar tanggungan")) return LeaveType.UNPAID;
  return LeaveType.ANNUAL;
}

function parseFlexibleDate(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (trimmed === "hari ini") {
    return formatDate(today);
  }

  if (trimmed === "besok") {
    const date = new Date(today);
    date.setDate(date.getDate() + 1);
    return formatDate(date);
  }

  if (trimmed === "lusa") {
    const date = new Date(today);
    date.setDate(date.getDate() + 2);
    return formatDate(date);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const delimiter = trimmed.includes("/") ? "/" : "-";
  const parts = trimmed.split(delimiter);

  if (parts.length !== 3) {
    return null;
  }

  const [day, month, rawYear] = parts.map((part) => Number.parseInt(part, 10));
  let year = rawYear;
  if (String(year).length === 2) {
    year += 2000;
  }

  if (day > 31 || month > 12) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatDate(date);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function extractReason(prompt: string): string | undefined {
  const reasonMatch = prompt.match(
    /\b(?:dengan alasan|alasan|karena|untuk)\b\s*[:\-]?\s*(.+)$/i
  );

  if (!reasonMatch) {
    return undefined;
  }

  return reasonMatch[1].trim();
}
