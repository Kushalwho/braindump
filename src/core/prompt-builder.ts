import type { CapturedSession, CompressionResult } from "../types/index.js";

/**
 * Builds the self-summarizing resume prompt (RESUME.md).
 * Uses the compressed session data to generate a structured handoff document.
 */
export function buildResumePrompt(
  session: CapturedSession,
  compressed: CompressionResult
): string {
  // TODO: Assemble the RESUME.md template with session data
  throw new Error("Not implemented");
}
