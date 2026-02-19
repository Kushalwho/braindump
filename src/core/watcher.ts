import { getAdapter } from "../adapters/index.js";
import type {
  AgentId,
  SessionInfo,
  WatcherEvent,
  WatcherOptions,
  WatcherState,
} from "../types/index.js";

const DEFAULT_INTERVAL_MS = 30_000;
const ALL_AGENTS: AgentId[] = ["claude-code", "cursor", "codex"];

interface SessionTrackingState {
  unchangedIntervals: number;
  hadGrowth: boolean;
  rateLimitEmitted: boolean;
}

/**
 * Polling watcher for agent sessions.
 * Uses adapter.listSessions() snapshots to detect changes and stale sessions.
 */
export class Watcher {
  private static activeInstance: Watcher | null = null;

  private state: WatcherState = {
    timestamp: new Date().toISOString(),
    agents: [],
    activeSessions: {},
    running: false,
  };

  private options: WatcherOptions = {};
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private tracking = new Map<string, SessionTrackingState>();

  async start(options: WatcherOptions = {}): Promise<void> {
    if (this.state.running) {
      return;
    }

    if (Watcher.activeInstance && Watcher.activeInstance !== this) {
      throw new Error("Watcher is already running in this process");
    }

    const agents =
      options.agents && options.agents.length > 0
        ? [...options.agents]
        : await this.detectAgents();

    this.options = {
      ...options,
      agents,
      interval: options.interval ?? DEFAULT_INTERVAL_MS,
    };

    this.state = {
      timestamp: new Date().toISOString(),
      agents,
      activeSessions: {},
      running: true,
    };

    Watcher.activeInstance = this;
    await this.takeSnapshot();

    const interval = this.options.interval ?? DEFAULT_INTERVAL_MS;
    this.pollTimer = setInterval(() => {
      void this.takeSnapshot();
    }, interval);
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.state = {
      ...this.state,
      timestamp: new Date().toISOString(),
      running: false,
    };
    this.tracking.clear();

    if (Watcher.activeInstance === this) {
      Watcher.activeInstance = null;
    }
  }

  getState(): WatcherState | null {
    return this.state;
  }

  async takeSnapshot(): Promise<WatcherState> {
    const now = new Date().toISOString();
    const agents = this.state.agents;

    const activeSessions: WatcherState["activeSessions"] = {};
    const seenKeys = new Set<string>();
    let emittedEventCount = 0;

    for (const agentId of agents) {
      const adapter = getAdapter(agentId);
      let sessions: SessionInfo[] = [];

      try {
        sessions = await adapter.listSessions(this.options.projectPath);
      } catch {
        continue;
      }

      for (const session of sessions) {
        const sessionId = session.id;
        const sessionKey = this.makeSessionKey(agentId, sessionId);
        seenKeys.add(sessionKey);

        const messageCount = session.messageCount ?? 0;
        const previous = this.state.activeSessions[sessionKey];
        const tracking = this.tracking.get(sessionKey) ?? {
          unchangedIntervals: 0,
          hadGrowth: false,
          rateLimitEmitted: false,
        };

        activeSessions[sessionKey] = {
          messageCount,
          lastCheckedAt: now,
          lastChangedAt: previous?.lastChangedAt,
        };

        if (!previous) {
          activeSessions[sessionKey].lastChangedAt = now;
          tracking.unchangedIntervals = 0;
          tracking.hadGrowth = false;
          tracking.rateLimitEmitted = false;
          emittedEventCount += this.emitEvent({
            type: "new-session",
            agentId,
            sessionId,
            timestamp: now,
            details: `Detected new session ${sessionId}`,
          });
        } else if (messageCount > previous.messageCount) {
          activeSessions[sessionKey].lastChangedAt = now;
          tracking.unchangedIntervals = 0;
          tracking.hadGrowth = true;
          tracking.rateLimitEmitted = false;
          emittedEventCount += this.emitEvent({
            type: "session-update",
            agentId,
            sessionId,
            timestamp: now,
            details: `Message count ${previous.messageCount} -> ${messageCount}`,
          });
        } else if (messageCount === previous.messageCount) {
          tracking.unchangedIntervals += 1;
          activeSessions[sessionKey].lastChangedAt = previous.lastChangedAt;

          // Heuristic rate-limit signal: stale after growth across 2+ checks.
          if (
            tracking.unchangedIntervals >= 2 &&
            messageCount > 0 &&
            tracking.hadGrowth &&
            !tracking.rateLimitEmitted
          ) {
            tracking.rateLimitEmitted = true;
            emittedEventCount += this.emitEvent({
              type: "rate-limit",
              agentId,
              sessionId,
              timestamp: now,
              details: "Session stale for 2+ polls after prior growth",
            });
          }
        } else {
          activeSessions[sessionKey].lastChangedAt = now;
          tracking.unchangedIntervals = 0;
          tracking.hadGrowth = false;
          tracking.rateLimitEmitted = false;
          emittedEventCount += this.emitEvent({
            type: "session-update",
            agentId,
            sessionId,
            timestamp: now,
            details: `Message count decreased ${previous.messageCount} -> ${messageCount}`,
          });
        }

        this.tracking.set(sessionKey, tracking);
      }
    }

    for (const existingKey of Object.keys(this.state.activeSessions)) {
      if (!seenKeys.has(existingKey)) {
        this.tracking.delete(existingKey);
      }
    }

    this.state = {
      timestamp: now,
      agents,
      activeSessions,
      running: this.state.running,
    };

    if (emittedEventCount === 0 && agents.length > 0) {
      this.emitEvent({
        type: "idle",
        agentId: agents[0],
        timestamp: now,
        details: "No session changes detected",
      });
    }

    return this.state;
  }

  private async detectAgents(): Promise<AgentId[]> {
    const detected: AgentId[] = [];
    for (const agentId of ALL_AGENTS) {
      try {
        const adapter = getAdapter(agentId);
        if (await adapter.detect()) {
          detected.push(agentId);
        }
      } catch {
        // Skip failing adapters.
      }
    }
    return detected;
  }

  private emitEvent(event: WatcherEvent): number {
    if (!this.options.onEvent) {
      return 0;
    }
    try {
      this.options.onEvent(event);
      return 1;
    } catch {
      return 0;
    }
  }

  private makeSessionKey(agentId: AgentId, sessionId: string): string {
    return `${agentId}:${sessionId}`;
  }
}
