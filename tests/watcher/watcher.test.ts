import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as adapters from "../../src/adapters/index.js";
import { Watcher } from "../../src/core/watcher.js";
import type { AgentAdapter, AgentId, SessionInfo, WatcherEvent } from "../../src/types/index.js";

describe("Watcher", () => {
  let watcher: Watcher;
  let adapterMap: Record<AgentId, AgentAdapter>;

  beforeEach(() => {
    vi.useFakeTimers();
    watcher = new Watcher();

    adapterMap = {
      "claude-code": createMockAdapter("claude-code"),
      cursor: createMockAdapter("cursor"),
      codex: createMockAdapter("codex"),
    };

    vi.spyOn(adapters, "getAdapter").mockImplementation(
      (agentId: AgentId) => adapterMap[agentId],
    );
  });

  afterEach(async () => {
    await watcher.stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should start watching and detect session updates", async () => {
    const claude = adapterMap["claude-code"];
    const listSessions = vi.mocked(claude.listSessions);
    listSessions
      .mockResolvedValueOnce([session("s1", 1)])
      .mockResolvedValueOnce([session("s1", 2)]);

    const events: WatcherEvent[] = [];
    await watcher.start({
      agents: ["claude-code"],
      interval: 1000,
      onEvent: (event) => events.push(event),
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(events.some((event) => event.type === "session-update")).toBe(true);
  });

  it("should detect new sessions", async () => {
    const claude = adapterMap["claude-code"];
    const listSessions = vi.mocked(claude.listSessions);
    listSessions
      .mockResolvedValueOnce([session("s1", 1)])
      .mockResolvedValueOnce([session("s1", 1), session("s2", 1)]);

    const events: WatcherEvent[] = [];
    await watcher.start({
      agents: ["claude-code"],
      interval: 1000,
      onEvent: (event) => events.push(event),
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(
      events.some(
        (event) =>
          event.type === "new-session" && event.sessionId === "s2",
      ),
    ).toBe(true);
  });

  it("should emit rate-limit event when session goes stale", async () => {
    const claude = adapterMap["claude-code"];
    const listSessions = vi.mocked(claude.listSessions);
    listSessions
      .mockResolvedValueOnce([session("s1", 1)])
      .mockResolvedValueOnce([session("s1", 2)])
      .mockResolvedValueOnce([session("s1", 2)])
      .mockResolvedValueOnce([session("s1", 2)]);

    const events: WatcherEvent[] = [];
    await watcher.start({
      agents: ["claude-code"],
      interval: 1000,
      onEvent: (event) => events.push(event),
    });

    await vi.advanceTimersByTimeAsync(3000);

    const rateLimitEvents = events.filter((event) => event.type === "rate-limit");
    expect(rateLimitEvents.length).toBe(1);
    expect(rateLimitEvents[0].sessionId).toBe("s1");
  });

  it("should handle adapter errors gracefully", async () => {
    const claude = adapterMap["claude-code"];
    vi.mocked(claude.listSessions).mockResolvedValue([session("s1", 3)]);
    vi.mocked(adapterMap.cursor.listSessions).mockRejectedValue(
      new Error("cursor db locked"),
    );

    await watcher.start({
      agents: ["claude-code", "cursor"],
      interval: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    const state = watcher.getState();
    expect(state?.activeSessions["claude-code:s1"]?.messageCount).toBe(3);
  });

  it("should stop watching and clear interval", async () => {
    const claude = adapterMap["claude-code"];
    const listSessions = vi.mocked(claude.listSessions);
    listSessions.mockResolvedValue([session("s1", 1)]);

    await watcher.start({
      agents: ["claude-code"],
      interval: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);
    const callsBeforeStop = listSessions.mock.calls.length;

    await watcher.stop();
    await vi.advanceTimersByTimeAsync(3000);

    expect(listSessions.mock.calls.length).toBe(callsBeforeStop);
    expect(watcher.getState()?.running).toBe(false);
  });

  it("should only watch specified agents", async () => {
    vi.mocked(adapterMap["claude-code"].listSessions).mockResolvedValue([]);
    vi.mocked(adapterMap.cursor.listSessions).mockResolvedValue([]);
    vi.mocked(adapterMap.codex.listSessions).mockResolvedValue([]);

    await watcher.start({
      agents: ["claude-code"],
      interval: 1000,
    });

    expect(adapterMap["claude-code"].listSessions).toHaveBeenCalledTimes(1);
    expect(adapterMap.cursor.listSessions).not.toHaveBeenCalled();
    expect(adapterMap.codex.listSessions).not.toHaveBeenCalled();
  });

  it("should filter by project path", async () => {
    const claude = adapterMap["claude-code"];
    const listSessions = vi.mocked(claude.listSessions);
    listSessions.mockResolvedValue([session("s1", 1)]);

    await watcher.start({
      agents: ["claude-code"],
      interval: 1000,
      projectPath: "/tmp/project-a",
    });

    expect(listSessions).toHaveBeenCalledWith("/tmp/project-a");
  });
});

function createMockAdapter(agentId: AgentId): AgentAdapter {
  return {
    agentId,
    detect: vi.fn(async () => true),
    listSessions: vi.fn(async () => []),
    capture: vi.fn(async () => {
      throw new Error("not used");
    }),
    captureLatest: vi.fn(async () => {
      throw new Error("not used");
    }),
  };
}

function session(id: string, messageCount: number): SessionInfo {
  return {
    id,
    messageCount,
    lastActiveAt: new Date().toISOString(),
  };
}
