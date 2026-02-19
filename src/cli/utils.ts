import { existsSync, lstatSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Resolve the output path for RESUME.md.
 * - If path is a directory or ends with `/`, write RESUME.md inside it.
 * - Otherwise treat as a file path.
 */
export function resolveOutputPath(
  outputFlag: string | undefined,
  projectPath: string
): { resumePath: string; sessionDir: string } {
  if (!outputFlag) {
    const handoffDir = join(projectPath, ".handoff");
    return { resumePath: join(handoffDir, "RESUME.md"), sessionDir: handoffDir };
  }

  const isDir =
    outputFlag.endsWith("/") ||
    outputFlag.endsWith("\\") ||
    (existsSync(outputFlag) && lstatSync(outputFlag).isDirectory());

  if (isDir) {
    return { resumePath: join(outputFlag, "RESUME.md"), sessionDir: outputFlag };
  }

  return { resumePath: outputFlag, sessionDir: dirname(outputFlag) };
}
