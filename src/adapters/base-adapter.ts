import type { AgentAdapter, AgentId, CapturedSession, SessionInfo } from "../types/index.js";

/**
 * Base class with shared utilities for all adapters.
 * Concrete adapters extend this and implement the abstract methods.
 */
export abstract class BaseAdapter implements AgentAdapter {
  abstract agentId: AgentId;

  abstract detect(): Promise<boolean>;
  abstract listSessions(projectPath?: string): Promise<SessionInfo[]>;
  abstract capture(sessionId: string): Promise<CapturedSession>;
  abstract captureLatest(projectPath?: string): Promise<CapturedSession>;
}
