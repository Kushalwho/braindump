import type { ResumeProvider, ProviderOptions } from "../types/index.js";

/**
 * Writes the resume prompt to .handoff/RESUME.md in the project directory.
 */
export class FileProvider implements ResumeProvider {
  async deliver(content: string, options?: ProviderOptions): Promise<void> {
    // TODO: Create .handoff/ directory if needed, write RESUME.md
    throw new Error("Not implemented");
  }
}
