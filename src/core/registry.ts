import type { AgentId, AgentMeta } from "../types/index.js";

/**
 * Agent metadata registry — storage paths, context windows, memory files per agent.
 */
export const AGENT_REGISTRY: Record<AgentId, AgentMeta> = {
  "claude-code": {
    id: "claude-code",
    name: "Claude Code",
    storagePaths: {
      linux: "~/.claude/projects/",
      darwin: "~/.claude/projects/",
      win32: "~/.claude/projects/",
    },
    contextWindow: 200_000,
    usableTokens: 120_000,
    memoryFiles: ["CLAUDE.md", ".claude/CLAUDE.md"],
  },
  cursor: {
    id: "cursor",
    name: "Cursor",
    storagePaths: {
      linux: "~/.config/Cursor/User/workspaceStorage/",
      darwin: "~/Library/Application Support/Cursor/User/workspaceStorage/",
      win32: "%APPDATA%/Cursor/User/workspaceStorage/",
    },
    contextWindow: 64_000,
    usableTokens: 38_000,
    memoryFiles: [".cursorrules", ".cursor/rules/"],
  },
  codex: {
    id: "codex",
    name: "Codex CLI",
    storagePaths: {
      linux: "~/.codex/sessions/",
      darwin: "~/.codex/sessions/",
      win32: "~/.codex/sessions/",
    },
    contextWindow: 200_000,
    usableTokens: 120_000,
    memoryFiles: ["AGENTS.md", "~/.codex/AGENTS.md"],
  },
};

/**
 * Get the usable token budget for a given target.
 */
export function getUsableTokenBudget(
  target: AgentId | "clipboard" | "file"
): number {
  if (target === "clipboard" || target === "file") {
    return 19_000; // Universal safe default
  }
  return AGENT_REGISTRY[target].usableTokens;
}
