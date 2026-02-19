import { describe, it, expect } from "vitest";

describe("Compression Engine", () => {
  describe("buildLayers", () => {
    it.todo("should create all 7 priority layers");
    it.todo("should always include priority 1 (task state)");
  });

  describe("compress", () => {
    it.todo("should fit within the token budget");
    it.todo("should include higher priority layers first");
    it.todo("should report dropped layers");
  });
});
