import { describe, it, expect } from "vitest";

describe("CursorAdapter", () => {
  describe("detect", () => {
    it.todo("should return true when Cursor workspaceStorage exists");
    it.todo("should return false when directory does not exist");
  });

  describe("listSessions", () => {
    it.todo("should list composer sessions from SQLite");
  });

  describe("capture", () => {
    it.todo("should read messages from state.vscdb");
    it.todo("should handle both modern and legacy formats");
  });
});
