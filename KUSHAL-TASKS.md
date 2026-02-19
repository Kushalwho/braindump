# AgentRelay — Kushal's Task Sheet (Round 2)

## Status

Your Round 1 work is merged (PR #2). The full pipeline works end-to-end now — `agentrelay handoff` captures from Claude Code, compresses, and generates RESUME.md.

But we found 3 bugs during real testing. Your Round 2 tasks fix them.

## Your Branch: `feat/smart-extraction`

```bash
git checkout main
git pull origin main
npm install
git checkout -b feat/smart-extraction
```

---

## Context: What's wrong

We ran `agentrelay handoff` on a real Claude Code session. Output issues:

1. **Git branch shows "unknown"** — `extractProjectContext()` exists but is never called during capture. The session's `project` field only has `path` and `name`, no git info.

2. **Task description is junk** — the adapter grabs the first user message as the task description. But the first message in our session was `"[Request interrupted by user for tool use]"`. Useless.

3. **Decisions and blockers are always `[]`** — nobody scans the conversation to extract things like "I'll use Express instead of Fastify" or "Error: OAuth token refresh failed".

---

## Tasks (in order)

### Task 1: Wire `extractProjectContext()` into the adapter's `capture()`

**File:** `src/adapters/claude-code/adapter.ts`

Right now `capture()` builds the session with a bare project object:
```typescript
project: {
  path: inferredProjectPath,
  name: path.basename(inferredProjectPath),
}
```

Fix: import and call `extractProjectContext()` from `../../core/project-context.js`, then spread its result into the session's project field:

```typescript
import { extractProjectContext } from "../../core/project-context.js";

// Inside capture(), after building the session:
const projectContext = await extractProjectContext(inferredProjectPath);
session.project = { ...session.project, ...projectContext };
```

This fills in `gitBranch`, `gitStatus`, `gitLog`, `structure`, and `memoryFileContents`.

**Test:** After this change, run `npx tsx src/cli/index.ts handoff --source claude-code` and check that `.handoff/RESUME.md` shows the real git branch instead of "unknown".

### Task 2: Build a conversation analyzer

**File:** `src/core/conversation-analyzer.ts` (create new file)

Create a module that scans conversation messages and extracts structured info.

```typescript
import type { ConversationMessage } from "../types/index.js";

export interface ConversationAnalysis {
  taskDescription: string;
  decisions: string[];
  blockers: string[];
  completedSteps: string[];
}

export function analyzeConversation(messages: ConversationMessage[]): ConversationAnalysis {
  return {
    taskDescription: extractTaskDescription(messages),
    decisions: extractDecisions(messages),
    blockers: extractBlockers(messages),
    completedSteps: extractCompletedSteps(messages),
  };
}
```

#### `extractTaskDescription(messages)`

Find the first **meaningful** user message. Skip messages that are:
- Shorter than 15 characters
- Contain "interrupted" or "Request interrupted"
- Are just "yes", "ok", "sure", "continue", "go ahead", etc.
- Start with "[" (system-injected messages)

Truncate to 300 characters. Fallback to `"Unknown task"` if nothing found.

#### `extractDecisions(messages)`

Scan **assistant** messages for decision patterns. Look for phrases like:
- "I'll use X instead of Y" / "I'll go with X"
- "Let's use X" / "Let's go with X"
- "decided to" / "choosing X over Y"
- "better to use X" / "X is better than Y"
- "using X for" / "picked X because"

Extract the sentence containing the pattern. Deduplicate. Cap at 10 decisions.

#### `extractBlockers(messages)`

Scan **all** messages for error/blocker patterns:
- Lines containing "Error:", "error:", "ERROR"
- Lines containing "failed", "Failed", "FAILED"
- Lines containing "unable to", "can't", "cannot"
- Lines containing "permission denied", "not found", "404", "500", "timeout"
- Lines matching stack trace patterns (e.g., "at Object.<anonymous>")

Extract just the relevant line (not the whole message). Deduplicate. Cap at 10 blockers.

#### `extractCompletedSteps(messages)`

Scan **assistant** messages for completion signals:
- "Done", "Complete", "Finished", "Created", "Added", "Updated", "Fixed", "Implemented"
- Look for these at the start of a sentence or after a tool use

Extract a short summary (first 100 chars of the sentence). Cap at 15 steps.

### Task 3: Integrate analyzer into the adapter

**File:** `src/adapters/claude-code/adapter.ts`

After building the messages array in `capture()`, call `analyzeConversation(messages)` and use its output to populate the `task`, `decisions`, and `blockers` fields:

```typescript
import { analyzeConversation } from "../../core/conversation-analyzer.js";

// Inside capture(), after building messages array:
const analysis = analyzeConversation(messages);

// Then in the CapturedSession object:
decisions: analysis.decisions,
blockers: analysis.blockers,
task: {
  description: analysis.taskDescription,
  completed: analysis.completedSteps,
  remaining: [],
  inProgress: lastAssistantMessage ? lastAssistantMessage.substring(0, 200) : undefined,
  blockers: analysis.blockers,
},
```

### Task 4: Add a richer test fixture

**File:** `tests/fixtures/claude-code-session-rich.jsonl`

Create a 20+ line JSONL fixture that has:
- A clear first user message describing a task (e.g., "Build a REST API with JWT auth")
- An assistant message with a decision ("I'll use Express instead of Fastify because...")
- An assistant message with a completed step ("Created the auth middleware")
- A tool_result with an error ("Error: ECONNREFUSED 127.0.0.1:5432")
- An assistant message acknowledging the error ("The database connection failed, let me fix the connection string")
- More back and forth showing progress
- At least 3 file changes (Write/Edit tool_use blocks)

Then add tests in `tests/adapters/claude-code.test.ts`:
```typescript
describe("conversation analysis", () => {
  it("should extract a meaningful task description");
  it("should find decisions from assistant messages");
  it("should detect errors and blockers");
  it("should identify completed steps");
});
```

### Task 5: Tests for the conversation analyzer

**File:** `tests/core/conversation-analyzer.test.ts` (create new file)

Test the analyzer directly with crafted message arrays:

```typescript
import { describe, it, expect } from "vitest";
import { analyzeConversation } from "../../src/core/conversation-analyzer.js";

describe("Conversation Analyzer", () => {
  it("should skip short/interrupted messages for task description");
  it("should extract decisions from 'I'll use X' patterns");
  it("should extract blockers from error messages");
  it("should extract completed steps from 'Created/Added/Fixed' patterns");
  it("should deduplicate decisions and blockers");
  it("should cap results at limits (10 decisions, 10 blockers, 15 steps)");
});
```

---

## Files you'll create or edit

| File | Action |
|------|--------|
| `src/core/conversation-analyzer.ts` | **Create new** |
| `src/adapters/claude-code/adapter.ts` | Edit (wire in project context + analyzer) |
| `tests/core/conversation-analyzer.test.ts` | **Create new** |
| `tests/fixtures/claude-code-session-rich.jsonl` | **Create new** |
| `tests/adapters/claude-code.test.ts` | Edit (add analyzer integration tests) |

## Files NOT to touch

- `src/cli/index.ts` — Prateek owns this
- `src/core/compression.ts` — Prateek owns this
- `src/core/prompt-builder.ts` — Prateek owns this
- `src/core/token-estimator.ts` — Prateek owns this

---

## When You're Done

```bash
# Verify
npx tsc --noEmit
npx vitest run

# Smoke test with real data
npx tsx src/cli/index.ts handoff --source claude-code
cat .handoff/RESUME.md
# Verify: git branch is correct, decisions are populated, task description makes sense

# Push
git add -A
git commit -m "feat: smart extraction - conversation analyzer, project context wiring"
git push -u origin feat/smart-extraction
gh pr create --base main --title "feat: smart extraction - decisions, blockers, task inference"
```

Tell Prateek so he can review and merge.
