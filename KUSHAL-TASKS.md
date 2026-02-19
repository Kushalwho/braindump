# Braindump — Kushal's Task Sheet (Round 5)

## Status

Rounds 1-4 are merged (PRs #2, #4, #6, #8). All 3 adapters + watcher working, 70 tests passing. Watch CLI fully wired (PR #9).

**Round 5 goal:** Harden adapters with schema validation, improve Cursor edge cases, expand test coverage, and clean up dead code — all prep for npm publish.

## Your Branch: `feat/validation`

```bash
git checkout main
git pull origin main
npm install
git checkout -b feat/validation
```

---

## Context: What exists now

- All 3 adapters are working: Claude Code (JSONL), Cursor (SQLite), Codex (JSONL)
- Watcher is fully implemented with polling + rate-limit heuristics
- 70 tests passing across 8 test files
- `CapturedSession` is the core contract — adapters produce it, engine consumes it
- There is NO runtime validation on `CapturedSession` — if an adapter produces a malformed object, it silently breaks downstream
- `src/providers/agent-provider.ts` is a dead stub (throws "Not implemented") — never used
- `chokidar` is in package.json but never imported anywhere (watcher uses `setInterval` polling instead)

---

## Tasks (in order)

### Task 1: Add Zod schema validation for CapturedSession

**Install:** `npm install zod`

**File:** `src/core/validation.ts` (create new)

Create Zod schemas that validate the `CapturedSession` shape. This catches adapter bugs early instead of letting malformed data silently break compression/prompt-building.

```typescript
import { z } from "zod";

export const ConversationMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
  toolName: z.string().optional(),
  timestamp: z.string().optional(),
  tokenCount: z.number().optional(),
});

export const FileChangeSchema = z.object({
  path: z.string(),
  changeType: z.enum(["created", "modified", "deleted"]),
  diff: z.string().optional(),
  language: z.string().optional(),
});

export const TaskStateSchema = z.object({
  description: z.string(),
  completed: z.array(z.string()),
  remaining: z.array(z.string()),
  inProgress: z.string().optional(),
  blockers: z.array(z.string()),
});

export const ProjectContextSchema = z.object({
  path: z.string(),
  name: z.string().optional(),
  gitBranch: z.string().optional(),
  gitStatus: z.string().optional(),
  gitLog: z.array(z.string()).optional(),
  structure: z.string().optional(),
  memoryFileContents: z.string().optional(),
});

export const CapturedSessionSchema = z.object({
  version: z.literal("1.0"),
  source: z.enum(["claude-code", "cursor", "codex"]),
  capturedAt: z.string(),
  sessionId: z.string(),
  sessionStartedAt: z.string().optional(),
  project: ProjectContextSchema,
  conversation: z.object({
    messageCount: z.number(),
    estimatedTokens: z.number(),
    summary: z.string().optional(),
    messages: z.array(ConversationMessageSchema),
  }),
  filesChanged: z.array(FileChangeSchema),
  decisions: z.array(z.string()),
  blockers: z.array(z.string()),
  task: TaskStateSchema,
});

/**
 * Validate a CapturedSession object. Throws ZodError if invalid.
 */
export function validateSession(data: unknown) {
  return CapturedSessionSchema.parse(data);
}

/**
 * Safe validation — returns { success, data, error } without throwing.
 */
export function safeValidateSession(data: unknown) {
  return CapturedSessionSchema.safeParse(data);
}
```

Then add a `validate()` call in each adapter's `capture()` and `captureLatest()` methods, right before returning the session:

```typescript
import { validateSession } from "../core/validation.js";

// At the end of capture() / captureLatest():
const session = { version: "1.0", source: "cursor", ... };
return validateSession(session) as CapturedSession;
```

This ensures every adapter returns valid data or throws a clear Zod error.

### Task 2: Improve Cursor adapter workspace resolution

**File:** `src/adapters/cursor/adapter.ts`

**Problem:** The Cursor adapter finds workspace storage by looking for `workspace.json` files. But some Cursor workspaces don't have this file, especially older ones or ones that were opened from the terminal with `cursor .`.

**Fix:** Add a fallback strategy:

1. Try the current approach (find `workspace.json` and match project path)
2. If no match found, glob the workspace storage directories and check the hashed folder names
3. As last resort, find the most recently modified `state.vscdb` file in any workspace folder

Implementation hint:
```typescript
// Current approach:
// workspace.json exists → read it → match folder URI → found!

// Fallback 1: Check folder hashes
// Cursor uses a hash of the folder URI as the workspace ID
// We can try to compute the hash of our project path and look for it

// Fallback 2: Most recent state.vscdb
// If all else fails, return the most recently modified workspace
// This is a guess but usually correct for active projects
```

### Task 3: Write validation + edge case tests

**File:** `tests/core/validation.test.ts` (create new)

Tests for the Zod schemas:

- `should validate a correct CapturedSession` — pass a well-formed object, expect success
- `should reject session with missing required fields` — omit `version`, `source`, `sessionId`
- `should reject session with wrong version` — pass `version: "2.0"`, expect failure
- `should reject invalid message role` — pass `role: "admin"`, expect failure
- `should reject invalid changeType` — pass `changeType: "renamed"`, expect failure
- `should accept session with all optional fields omitted` — minimal valid object
- `should return typed data from validateSession` — verify return type matches `CapturedSession`
- `should use safeValidateSession without throwing` — verify success/error return shape

**File:** `tests/adapters/cursor.test.ts` (add to existing)

Add edge case tests:
- `should handle missing workspace.json gracefully` — workspace folder exists but no workspace.json
- `should fall back to most recent state.vscdb` — multiple workspaces, no exact match

**File:** `tests/adapters/claude-code.test.ts` (add to existing)

Add edge case tests:
- `should handle very large session files (1000+ messages)` — generate a large mock JSONL file
- `should skip duplicate messages` — same message ID appearing twice in JSONL

**File:** `tests/adapters/codex.test.ts` (add to existing)

Add edge case tests:
- `should handle empty JSONL file` — 0 bytes
- `should handle JSONL with only system entries` — no user/assistant messages

### Task 4: Remove dead code and unused dependencies

**Files to delete:**
- `src/providers/agent-provider.ts` — dead stub, never used, not exported from barrel

**Files to edit:**
- `package.json` — remove `chokidar` from dependencies (it's never imported; the watcher uses `setInterval` polling)

**Verify** after removing:
```bash
npx tsc --noEmit       # Should still compile
npx vitest run         # Should still pass
grep -r "chokidar" src/  # Should return nothing
grep -r "agent-provider" src/  # Should return nothing
```

---

## Files you'll create or edit

| File | Action |
|------|--------|
| `src/core/validation.ts` | **Create new** — Zod schemas |
| `src/adapters/cursor/adapter.ts` | **Edit** — add workspace resolution fallback + validate |
| `src/adapters/claude-code/adapter.ts` | **Edit** — add validate call |
| `src/adapters/codex/adapter.ts` | **Edit** — add validate call |
| `tests/core/validation.test.ts` | **Create new** — schema tests |
| `tests/adapters/cursor.test.ts` | **Edit** — add edge case tests |
| `tests/adapters/claude-code.test.ts` | **Edit** — add edge case tests |
| `tests/adapters/codex.test.ts` | **Edit** — add edge case tests |
| `src/providers/agent-provider.ts` | **Delete** |
| `package.json` | **Edit** — remove `chokidar`, add `zod` |

## Files NOT to touch

- `src/cli/index.ts` — Prateek owns this
- `src/core/compression.ts` — Prateek owns this
- `src/core/prompt-builder.ts` — Prateek owns this
- `src/providers/index.ts` — Prateek owns this (already cleaned up)
- `README.md` — Prateek owns this
- `tests/core/prompt-builder.test.ts` — Prateek owns this
- `tests/core/compression.test.ts` — Prateek owns this
- `tests/e2e/*` — Prateek owns these

---

## Reference: Current CapturedSession interface

```typescript
// src/types/index.ts
export interface CapturedSession {
  version: "1.0";
  source: AgentId;
  capturedAt: string;
  sessionId: string;
  sessionStartedAt?: string;
  project: ProjectContext;
  conversation: Conversation;
  filesChanged: FileChange[];
  decisions: string[];
  blockers: string[];
  task: TaskState;
}
```

The Zod schema must match this exactly. TypeScript types and Zod schemas should stay in sync — if someone changes the interface, the schema needs updating too.

## When You're Done

```bash
# Verify
npx tsc --noEmit
npx vitest run

# Check cleanup
grep -r "chokidar" src/     # should return nothing
grep -r "agent-provider" src/ # should return nothing

# Push
git add -A
git commit -m "feat: zod validation, cursor fallback, edge case tests, cleanup"
git push -u origin feat/validation
gh pr create --base main --title "feat: session validation + adapter hardening + cleanup"
```

Tell Prateek so he can review and merge.
