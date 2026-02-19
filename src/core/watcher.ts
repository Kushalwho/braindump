import type { WatcherState } from "../types/index.js";

export interface WatcherOptions {
  agents?: string[];
  interval?: number;
}

/**
 * File watcher for always-on mode.
 * Monitors agent session files for changes and detects rate limits.
 */
export class Watcher {
  private state: WatcherState | null = null;

  async start(options: WatcherOptions): Promise<void> {
    // TODO: Set up chokidar watchers for agent session directories
    throw new Error("Not implemented");
  }

  async stop(): Promise<void> {
    // TODO: Close all watchers, write final snapshot
    throw new Error("Not implemented");
  }

  getState(): WatcherState | null {
    return this.state;
  }
}
