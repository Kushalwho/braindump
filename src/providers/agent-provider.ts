import type { ResumeProvider, ProviderOptions } from "../types/index.js";

/**
 * Agent-specific formatting and launch instructions.
 * Tailors the resume prompt for a specific target agent.
 */
export class AgentProvider implements ResumeProvider {
  async deliver(content: string, options?: ProviderOptions): Promise<void> {
    // TODO: Format for target agent and deliver
    throw new Error("Not implemented");
  }
}
