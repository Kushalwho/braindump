import type { ResumeProvider, AgentId } from "../types/index.js";
import { FileProvider } from "./file-provider.js";
import { ClipboardProvider } from "./clipboard-provider.js";
import { AgentProvider } from "./agent-provider.js";

/**
 * Get the appropriate provider(s) for a given target.
 */
export function getProviders(
  target: AgentId | "clipboard" | "file"
): ResumeProvider[] {
  // TODO: Return appropriate providers based on target
  // Default: file + clipboard
  throw new Error("Not implemented");
}

export { FileProvider, ClipboardProvider, AgentProvider };
