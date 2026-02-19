import type { AgentAdapter, AgentId, DetectResult } from "../types/index.js";
import { ClaudeCodeAdapter } from "./claude-code/adapter.js";
import { CursorAdapter } from "./cursor/adapter.js";
import { CodexAdapter } from "./codex/adapter.js";

/**
 * Registry of all available adapters.
 */
const adapters: Record<AgentId, AgentAdapter> = {
  "claude-code": new ClaudeCodeAdapter(),
  cursor: new CursorAdapter(),
  codex: new CodexAdapter(),
};

/**
 * Get an adapter by agent ID.
 */
export function getAdapter(agentId: AgentId): AgentAdapter {
  return adapters[agentId];
}

/**
 * Get all registered adapters.
 */
export function getAllAdapters(): AgentAdapter[] {
  return Object.values(adapters);
}

/**
 * Detect which agents are installed on this machine.
 */
export async function detectAgents(): Promise<DetectResult[]> {
  // TODO: Run detect() on each adapter and collect results
  throw new Error("Not implemented");
}

/**
 * Auto-detect the most recently active agent for the given project path.
 */
export async function autoDetectSource(projectPath?: string): Promise<AgentAdapter | null> {
  // TODO: Check each adapter, find the one with the most recent session
  throw new Error("Not implemented");
}
