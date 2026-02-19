import { describe, it, expect } from "vitest";
import type { ConversationMessage } from "../../src/types/index.js";
import { analyzeConversation } from "../../src/core/conversation-analyzer.js";

function msg(
  role: ConversationMessage["role"],
  content: string,
): ConversationMessage {
  return { role, content };
}

describe("Conversation Analyzer", () => {
  it("should skip short/interrupted messages for task description", () => {
    const messages: ConversationMessage[] = [
      msg("user", "[Request interrupted by user for tool use]"),
      msg("user", "yes"),
      msg("assistant", "Build a resilient auth API with refresh token rotation."),
    ];

    const analysis = analyzeConversation(messages);

    expect(analysis.taskDescription).toBe(
      "Build a resilient auth API with refresh token rotation.",
    );
  });

  it("should extract decisions from common decision patterns", () => {
    const messages: ConversationMessage[] = [
      msg(
        "assistant",
        "I'll use Express instead of Fastify because middleware support is better.",
      ),
      msg("assistant", "Let's use zod for validation."),
      msg("assistant", "I decided to keep bcrypt over argon2 for compatibility."),
    ];

    const analysis = analyzeConversation(messages);

    expect(analysis.decisions.length).toBeGreaterThanOrEqual(3);
    expect(
      analysis.decisions.some((decision) =>
        decision.includes("Express instead of Fastify"),
      ),
    ).toBe(true);
    expect(
      analysis.decisions.some((decision) =>
        decision.toLowerCase().includes("let's use zod"),
      ),
    ).toBe(true);
  });

  it("should extract blockers from error messages", () => {
    const messages: ConversationMessage[] = [
      msg("tool", "Error: ECONNREFUSED 127.0.0.1:5432"),
      msg(
        "assistant",
        "Error: JWT_SECRET is undefined\nat Object.<anonymous> (src/auth/token.ts:12:7)",
      ),
      msg("assistant", "Permission denied while writing coverage report."),
    ];

    const analysis = analyzeConversation(messages);

    expect(analysis.blockers.length).toBeGreaterThanOrEqual(3);
    expect(
      analysis.blockers.some((blocker) => blocker.includes("ECONNREFUSED")),
    ).toBe(true);
    expect(
      analysis.blockers.some((blocker) =>
        blocker.includes("Stack trace: Object.<anonymous>"),
      ),
    ).toBe(true);
    expect(
      analysis.blockers.some((blocker) => blocker.includes("Permission denied")),
    ).toBe(true);
  });

  it("should extract completed steps from completion signals", () => {
    const messages: ConversationMessage[] = [
      msg(
        "assistant",
        "Created the auth middleware. Added refresh token endpoint. I'll add docs next.",
      ),
      msg("assistant", "Done. Fixed token expiration edge case."),
    ];

    const analysis = analyzeConversation(messages);

    expect(analysis.completedSteps.length).toBeGreaterThanOrEqual(3);
    expect(
      analysis.completedSteps.some((step) =>
        step.includes("Created the auth middleware"),
      ),
    ).toBe(true);
    expect(
      analysis.completedSteps.some((step) =>
        step.includes("Added refresh token endpoint"),
      ),
    ).toBe(true);
    expect(
      analysis.completedSteps.some((step) =>
        step.includes("Fixed token expiration edge case"),
      ),
    ).toBe(true);
    expect(
      analysis.completedSteps.some((step) =>
        step.toLowerCase().includes("i'll add docs next"),
      ),
    ).toBe(false);
  });

  it("should deduplicate decisions and blockers", () => {
    const messages: ConversationMessage[] = [
      msg("assistant", "I'll use Express instead of Fastify."),
      msg("assistant", "I'll use Express instead of Fastify."),
      msg("assistant", "Error: ECONNREFUSED 127.0.0.1:5432"),
      msg("tool", "Error: ECONNREFUSED 127.0.0.1:5432"),
    ];

    const analysis = analyzeConversation(messages);

    expect(analysis.decisions).toHaveLength(1);
    expect(analysis.blockers).toHaveLength(1);
  });

  it("should cap extracted results at configured limits", () => {
    const messages: ConversationMessage[] = [];

    for (let i = 0; i < 20; i++) {
      messages.push(
        msg("assistant", `I'll use library-${i} instead of library-${i + 1}.`),
      );
      messages.push(msg("assistant", `Error: failure-${i}`));
      messages.push(msg("assistant", `Implemented step-${i}.`));
    }

    const analysis = analyzeConversation(messages);

    expect(analysis.decisions).toHaveLength(10);
    expect(analysis.blockers).toHaveLength(10);
    expect(analysis.completedSteps).toHaveLength(15);
  });
});
