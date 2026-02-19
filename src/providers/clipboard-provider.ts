import type { ResumeProvider, ProviderOptions } from "../types/index.js";

/**
 * Copies the resume prompt to the system clipboard.
 */
export class ClipboardProvider implements ResumeProvider {
  async deliver(content: string, options?: ProviderOptions): Promise<void> {
    // TODO: Use clipboardy to copy content to clipboard
    throw new Error("Not implemented");
  }
}
