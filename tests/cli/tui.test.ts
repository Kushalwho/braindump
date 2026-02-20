import { describe, it, expect } from "vitest";
import { parseKey, renderOptions, type SelectOption } from "../../src/cli/tui.js";

describe("parseKey", () => {
  it("should return 'up' for arrow up escape sequence", () => {
    expect(parseKey(Buffer.from([0x1b, 0x5b, 0x41]))).toBe("up");
  });

  it("should return 'down' for arrow down escape sequence", () => {
    expect(parseKey(Buffer.from([0x1b, 0x5b, 0x42]))).toBe("down");
  });

  it("should return 'enter' for CR", () => {
    expect(parseKey(Buffer.from([0x0d]))).toBe("enter");
  });

  it("should return 'cancel' for Ctrl+C", () => {
    expect(parseKey(Buffer.from([0x03]))).toBe("cancel");
  });

  it("should return 'up' for 'k'", () => {
    expect(parseKey(Buffer.from("k"))).toBe("up");
  });

  it("should return 'down' for 'j'", () => {
    expect(parseKey(Buffer.from("j"))).toBe("down");
  });

  it("should return null for unrecognized input", () => {
    expect(parseKey(Buffer.from("x"))).toBeNull();
    expect(parseKey(Buffer.from("a"))).toBeNull();
    expect(parseKey(Buffer.from([0x1b]))).toBeNull();
  });
});

describe("renderOptions", () => {
  const options: SelectOption<string>[] = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta", hint: "second letter" },
    { value: "c", label: "Gamma" },
    { value: "d", label: "Delta" },
  ];

  it("should highlight the selected option with indicator", () => {
    const lines = renderOptions(options, 0, 0, 10);
    // Selected should have bold + indicator
    expect(lines[0]).toContain("\u276F");
    expect(lines[0]).toContain("Alpha");
    // Others should be dim
    expect(lines[1]).not.toContain("\u276F");
    expect(lines[1]).toContain("Beta");
  });

  it("should show hints for options that have them", () => {
    const lines = renderOptions(options, 0, 0, 10);
    expect(lines[1]).toContain("second letter");
  });

  it("should highlight middle selection correctly", () => {
    const lines = renderOptions(options, 2, 0, 10);
    expect(lines[2]).toContain("\u276F");
    expect(lines[2]).toContain("Gamma");
    expect(lines[0]).not.toContain("\u276F");
  });

  it("should show scroll-up indicator when offset > 0", () => {
    const lines = renderOptions(options, 2, 1, 2);
    expect(lines[0]).toContain("\u2191");
    expect(lines[0]).toContain("1 more");
  });

  it("should show scroll-down indicator when more items below", () => {
    const lines = renderOptions(options, 0, 0, 2);
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toContain("\u2193");
    expect(lastLine).toContain("2 more");
  });

  it("should not show scroll indicators when all items fit", () => {
    const lines = renderOptions(options, 0, 0, 10);
    expect(lines.length).toBe(4);
    for (const line of lines) {
      expect(line).not.toContain("\u2191");
      expect(line).not.toContain("\u2193");
    }
  });

  it("should show both scroll indicators when scrolled to middle", () => {
    const lines = renderOptions(options, 1, 1, 2);
    expect(lines[0]).toContain("\u2191");
    expect(lines[lines.length - 1]).toContain("\u2193");
  });
});
