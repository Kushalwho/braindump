import { describe, it, expect } from "vitest";

describe("ClaudeCodeAdapter", () => {
  describe("detect", () => {
    it.todo("should return true when ~/.claude/projects/ exists with .jsonl files");
    it.todo("should return false when directory does not exist");
  });

  describe("listSessions", () => {
    it.todo("should list all sessions sorted by most recent");
    it.todo("should filter by project path when provided");
  });

  describe("capture", () => {
    it.todo("should parse JSONL and return a CapturedSession");
    it.todo("should extract file changes from tool_use blocks");
    it.todo("should handle malformed JSONL lines gracefully");
  });

  describe("captureLatest", () => {
    it.todo("should capture the most recently modified session");
  });
});
