import type { ProjectContext } from "../types/index.js";

/**
 * Extract project context from the filesystem.
 * Gathers git info, directory tree, and memory file contents.
 */
export async function extractProjectContext(
  projectPath: string
): Promise<ProjectContext> {
  // TODO: Run git commands, build directory tree, read memory files
  throw new Error("Not implemented");
}
