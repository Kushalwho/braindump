import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveOutputPath } from "../../src/cli/utils.js";

describe("resolveOutputPath", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "braindump-cli-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should default to .handoff/RESUME.md when no output flag", () => {
    const result = resolveOutputPath(undefined, "/home/user/project");
    expect(result.resumePath).toBe(join("/home/user/project", ".handoff", "RESUME.md"));
    expect(result.sessionDir).toBe(join("/home/user/project", ".handoff"));
  });

  it("should write RESUME.md inside directory when path ends with /", () => {
    const result = resolveOutputPath("/tmp/output/", "/home/user/project");
    expect(result.resumePath).toBe(join("/tmp/output/", "RESUME.md"));
    expect(result.sessionDir).toBe("/tmp/output/");
  });

  it("should write RESUME.md inside existing directory", () => {
    const result = resolveOutputPath(tmpDir, "/home/user/project");
    expect(result.resumePath).toBe(join(tmpDir, "RESUME.md"));
    expect(result.sessionDir).toBe(tmpDir);
  });

  it("should treat non-directory path as file path", () => {
    const filePath = join(tmpDir, "custom-resume.md");
    const result = resolveOutputPath(filePath, "/home/user/project");
    expect(result.resumePath).toBe(filePath);
    expect(result.sessionDir).toBe(tmpDir);
  });

  it("should handle path ending with backslash as directory", () => {
    const result = resolveOutputPath("C:\\Users\\output\\", "/project");
    expect(result.resumePath).toBe(join("C:\\Users\\output\\", "RESUME.md"));
    expect(result.sessionDir).toBe("C:\\Users\\output\\");
  });

  it("should use dirname of file path as session dir", () => {
    const result = resolveOutputPath("/tmp/my-dir/output.md", "/project");
    expect(result.resumePath).toBe("/tmp/my-dir/output.md");
    expect(result.sessionDir).toBe("/tmp/my-dir");
  });

  it("should handle nested non-existent path as file", () => {
    const result = resolveOutputPath("/tmp/does-not-exist/resume.md", "/project");
    expect(result.resumePath).toBe("/tmp/does-not-exist/resume.md");
    expect(result.sessionDir).toBe("/tmp/does-not-exist");
  });
});
