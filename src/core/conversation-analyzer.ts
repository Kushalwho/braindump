import type { ConversationMessage } from "../types/index.js";

export interface ConversationAnalysis {
  taskDescription: string;
  decisions: string[];
  blockers: string[];
  completedSteps: string[];
}

const MAX_TASK_CHARS = 300;
const MAX_DECISIONS = 10;
const MAX_BLOCKERS = 10;
const MAX_COMPLETED_STEPS = 15;
const MAX_STEP_CHARS = 100;
const MAX_BLOCKER_CHARS = 160;

const ACK_ONLY = new Set([
  "yes",
  "ok",
  "okay",
  "sure",
  "continue",
  "go ahead",
  "proceed",
  "sounds good",
  "do it",
  "yep",
  "yeah",
]);

export function analyzeConversation(
  messages: ConversationMessage[],
): ConversationAnalysis {
  return {
    taskDescription: extractTaskDescription(messages),
    decisions: extractDecisions(messages),
    blockers: extractBlockers(messages),
    completedSteps: extractCompletedSteps(messages),
  };
}

function extractTaskDescription(messages: ConversationMessage[]): string {
  const userMessages = messages.filter((m) => m.role === "user");
  for (const message of userMessages) {
    if (!isMeaningfulTaskMessage(message.content)) {
      continue;
    }
    return truncate(cleanText(message.content), MAX_TASK_CHARS);
  }

  // Fallback to a meaningful assistant message when user prompts are too noisy.
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  for (const message of assistantMessages) {
    if (!isMeaningfulTaskMessage(message.content)) {
      continue;
    }
    return truncate(cleanText(message.content), MAX_TASK_CHARS);
  }

  return "Unknown task";
}

function extractDecisions(messages: ConversationMessage[]): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  const decisionPatterns = [
    /\b(?:i(?:'| a)?ll|i will)\s+(?:use|go with|choose|pick)\b/i,
    /\blet'?s\s+(?:use|go with)\b/i,
    /\bdecid(?:e|ed)\s+to\b/i,
    /\bchoos(?:e|ing)\b.*\bover\b/i,
    /\bbetter to use\b/i,
    /\bis better than\b/i,
    /\busing\b.*\bfor\b/i,
    /\bpicked\b.*\bbecause\b/i,
    /\binstead of\b/i,
  ];

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    const sentences = toSentences(message.content);
    for (const sentence of sentences) {
      if (!decisionPatterns.some((pattern) => pattern.test(sentence))) {
        continue;
      }
      const normalized = normalizeSummaryLine(sentence);
      if (!normalized) {
        continue;
      }
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push(normalized);
      if (results.length >= MAX_DECISIONS) {
        return results;
      }
    }
  }

  return results;
}

function extractBlockers(messages: ConversationMessage[]): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  const blockerPatterns = [
    /\berror\b/i,
    /\bfailed\b/i,
    /\bunable to\b/i,
    /\bcan't\b/i,
    /\bcannot\b/i,
    /permission denied/i,
    /\bnot found\b/i,
    /\b404\b/i,
    /\b500\b/i,
    /\btimeout\b/i,
    /\beconnrefused\b/i,
    /^at\s+\S+/i,
  ];

  for (const message of messages) {
    const lines = message.content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (!blockerPatterns.some((pattern) => pattern.test(line))) {
        continue;
      }
      const normalized = normalizeBlockerLine(line);
      if (!normalized) {
        continue;
      }
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push(normalized);
      if (results.length >= MAX_BLOCKERS) {
        return results;
      }
    }
  }

  return results;
}

function extractCompletedSteps(messages: ConversationMessage[]): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  const completionPatterns = [
    /\b(?:done|completed|finished|created|added|updated|fixed|implemented|resolved|configured|refactored|verified)\b/i,
    /\b(?:i have|i've|we have|we've)\s+(?:done|completed|finished|created|added|updated|fixed|implemented|resolved|configured|refactored|verified)\b/i,
  ];
  const futurePattern = /\b(?:i(?:'| a)?ll|i will|we(?:'| wi)?ll|going to)\b/i;

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    const sentences = toSentences(message.content);
    for (const sentence of sentences) {
      if (!completionPatterns.some((pattern) => pattern.test(sentence))) {
        continue;
      }
      if (futurePattern.test(sentence)) {
        continue;
      }
      const normalized = normalizeSummaryLine(sentence);
      if (!normalized) {
        continue;
      }
      const summary = truncate(normalized, MAX_STEP_CHARS);
      const key = summary.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      results.push(summary);
      if (results.length >= MAX_COMPLETED_STEPS) {
        return results;
      }
    }
  }

  return results;
}

function isMeaningfulTaskMessage(content: string): boolean {
  const cleaned = cleanText(content);
  if (!cleaned) {
    return false;
  }
  if (cleaned.length < 15) {
    return false;
  }
  if (cleaned.startsWith("[")) {
    return false;
  }
  if (/request interrupted|interrupted/i.test(cleaned)) {
    return false;
  }

  const normalized = cleaned.toLowerCase().replace(/[.!?,;:]/g, "").trim();
  if (ACK_ONLY.has(normalized)) {
    return false;
  }
  return true;
}

function toSentences(content: string): string[] {
  const normalized = cleanText(content).replace(/\r/g, " ");
  const matches = normalized.match(/[^.!?\n]+[.!?]?/g) ?? [];
  return matches.map((sentence) => cleanText(sentence)).filter(Boolean);
}

function normalizeSummaryLine(input: string): string {
  return cleanText(input).replace(/^[-*]\s*/, "").trim();
}

function normalizeBlockerLine(line: string): string {
  const cleaned = cleanText(line);
  if (!cleaned) {
    return "";
  }

  const stackMatch = cleaned.match(/^at\s+(.+)$/i);
  if (stackMatch) {
    return truncate(`Stack trace: ${stackMatch[1]}`, MAX_BLOCKER_CHARS);
  }

  const errorMatch = cleaned.match(/^error:\s*(.+)$/i);
  if (errorMatch) {
    return truncate(`Error: ${errorMatch[1]}`, MAX_BLOCKER_CHARS);
  }

  const failedMatch = cleaned.match(/^failed:\s*(.+)$/i);
  if (failedMatch) {
    return truncate(`Failed: ${failedMatch[1]}`, MAX_BLOCKER_CHARS);
  }

  return truncate(cleaned, MAX_BLOCKER_CHARS);
}

function truncate(input: string, maxChars: number): string {
  return input.length <= maxChars ? input : `${input.slice(0, maxChars)}...`;
}

function cleanText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}
