import { describe, it, expect } from "vitest";

describe("CodexAdapter", () => {
  describe("detect", () => {
    it.todo("should return true when ~/.codex/sessions/ exists");
    it.todo("should return false when directory does not exist");
  });

  describe("listSessions", () => {
    it.todo("should glob for session JSONL files");
  });

  describe("capture", () => {
    it.todo("should parse Codex JSONL format");
    it.todo("should handle role:developer as system");
  });
});
