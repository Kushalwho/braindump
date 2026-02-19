import { BaseAdapter } from "../base-adapter.js";
import type { AgentId, CapturedSession, SessionInfo } from "../../types/index.js";

/**
 * Adapter for Claude Code sessions.
 * Reads JSONL files from ~/.claude/projects/<path-hash>/<session-uuid>.jsonl
 */
export class ClaudeCodeAdapter extends BaseAdapter {
  agentId: AgentId = "claude-code";

  async detect(): Promise<boolean> {
    // TODO: Check if ~/.claude/projects/ exists and contains .jsonl files
    throw new Error("Not implemented");
  }

  async listSessions(projectPath?: string): Promise<SessionInfo[]> {
    // TODO: Scan ~/.claude/projects/ for session files
    throw new Error("Not implemented");
  }

  async capture(sessionId: string): Promise<CapturedSession> {
    // TODO: Parse JSONL session file and build CapturedSession
    throw new Error("Not implemented");
  }

  async captureLatest(projectPath?: string): Promise<CapturedSession> {
    // TODO: Find most recent session and capture it
    throw new Error("Not implemented");
  }
}
