# AgentRelay — Kushal's Task Sheet (Round 3)

## Status

Rounds 1 and 2 are merged (PRs #2 and #4). MVP is fully working — `agentrelay handoff` captures from Claude Code, enriches with project context, extracts decisions/blockers/tasks, compresses, and generates RESUME.md.

**Round 3 goal:** Add Cursor and Codex adapters so AgentRelay works with all 3 agents (v0.2 milestone from PRD).

## Your Branch: `feat/cursor-codex-adapters`

```bash
git checkout main
git pull origin main
npm install
git checkout -b feat/cursor-codex-adapters
```

---

## Context: What exists now

- `src/adapters/claude-code/adapter.ts` — Full working adapter (your Round 1+2 work)
- `src/adapters/cursor/adapter.ts` — Stub, all methods throw "Not implemented"
- `src/adapters/codex/adapter.ts` — Stub, all methods throw "Not implemented"
- `src/adapters/base-adapter.ts` — Base class with shared utilities
- `src/adapters/index.ts` — Adapter registry with `detectAgents()`, `autoDetectSource()`, `getAdapter()`
- `src/core/conversation-analyzer.ts` — Your Round 2 analyzer, use it in both new adapters
- `src/core/project-context.ts` — Your Round 2 context extractor, use it in both new adapters
- `src/core/registry.ts` — Has storage paths for all 3 agents per OS

The Claude Code adapter is the reference implementation. Follow its patterns for the new adapters.

---

## Tasks (in order)

### Task 1: Implement the Codex adapter

**File:** `src/adapters/codex/adapter.ts`

Codex CLI stores sessions at `~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<session-id>.jsonl`

Key differences from Claude Code:
- Sessions are nested by date (YYYY/MM/DD/ subdirectories)
- Filename format: `rollout-2025-01-22T10-30-00-abc123.jsonl`
- JSONL entries can have `role: "developer"` → map to `"system"`
- Content can be a string OR an array of content blocks (OpenAI format)
- Tool calls use `type: "tool_call"` with `name: "write_file"`, `"edit_file"`, `"shell"`, `"read_file"`
- Some entries have a `cwd` field → use as project path
- Memory file: `AGENTS.md` (project root or `~/.codex/AGENTS.md`)

Implementation:
1. `detect()` — Check if `~/.codex/sessions/` exists and has `.jsonl` files
2. `listSessions()` — Glob for `~/.codex/sessions/**/*.jsonl`, parse filenames for session IDs, read first/last lines for timestamps, sort by mtime descending
3. `capture(sessionId)` — Stream JSONL, extract messages/tool calls/file changes, call `analyzeConversation()` and `extractProjectContext()`
4. `captureLatest()` — Find most recent file and capture it

See PRD Section 9.4 for full spec.

### Task 2: Implement the Cursor adapter

**File:** `src/adapters/cursor/adapter.ts`

Cursor stores sessions in SQLite: `<app-data>/Cursor/User/workspaceStorage/<hash>/state.vscdb`

Platform paths (from registry.ts):
- macOS: `~/Library/Application Support/Cursor/User/workspaceStorage/`
- Linux: `~/.config/Cursor/User/workspaceStorage/`
- Windows: `%APPDATA%/Cursor/User/workspaceStorage/`

Key details:
- Open SQLite in **READ-ONLY mode**: `new Database(path, { readonly: true, fileMustExist: true })`
- Table: `ItemTable (key TEXT, value TEXT)`
- Try keys in order:
  1. `composer.composerData` → JSON with `allComposers` array (modern format)
  2. `workbench.panel.aichat.view.aichat.chatdata` → legacy format
- Individual messages: `bubbleId:<composerId>:<bubbleId>` keys
- Each workspace folder has a `workspace.json` with `{ "folder": "file:///path/to/project" }`
- Session ID format: `<workspace-hash>:<composerId>`
- Memory file: `.cursorrules` or `.cursor/rules/*.mdc`
- `better-sqlite3` is already in package.json dependencies

Implementation:
1. `detect()` — Check if workspaceStorage path exists for current platform
2. `listSessions()` — Scan workspace folders, open each state.vscdb, read composer list, resolve project paths from workspace.json
3. `capture(sessionId)` — Parse workspace-hash:composerId, open correct state.vscdb, read messages, call `analyzeConversation()` and `extractProjectContext()`
4. `captureLatest()` — Find most recently updated composer and capture it

See PRD Sections 9.2-9.3 for full spec.

### Task 3: Add test fixtures

**Files to create:**
- `tests/fixtures/codex-session.jsonl` — 15+ line JSONL fixture with Codex format entries (role: user/assistant/developer, tool_calls, content as string and array, cwd field)
- `tests/fixtures/cursor-state.json` — Mock data representing what you'd read from SQLite keys (since we can't ship a .vscdb in fixtures, mock the DB reads)

### Task 4: Write Codex adapter tests

**File:** `tests/adapters/codex.test.ts`

Replace the skipped stubs with real tests. Follow the Claude Code test patterns:
- Mock `os.homedir()` and create temp directory structure
- Test `detect()` with and without session files
- Test `listSessions()` ordering (most recent first)
- Test `capture()` message parsing, file change extraction, conversation analysis
- Test `captureLatest()` picks most recent
- Test `role: "developer"` → `"system"` mapping
- Test content as string vs array format

### Task 5: Write Cursor adapter tests

**File:** `tests/adapters/cursor.test.ts`

Replace the skipped stubs with real tests:
- Mock the workspace storage directory
- For SQLite testing, either:
  - Create a real temp SQLite DB with better-sqlite3 in the test setup, or
  - Abstract the DB reads behind a method you can mock
- Test `detect()` for different platforms
- Test `listSessions()` with multiple workspaces
- Test `capture()` with modern composer format
- Test session ID parsing (`workspace-hash:composerId`)
- Test `captureLatest()`

---

## Files you'll create or edit

| File | Action |
|------|--------|
| `src/adapters/codex/adapter.ts` | **Rewrite** (replace stub) |
| `src/adapters/cursor/adapter.ts` | **Rewrite** (replace stub) |
| `tests/adapters/codex.test.ts` | **Rewrite** (replace skipped stubs) |
| `tests/adapters/cursor.test.ts` | **Rewrite** (replace skipped stubs) |
| `tests/fixtures/codex-session.jsonl` | **Create new** |
| `tests/fixtures/cursor-state.json` | **Create new** |
| `src/adapters/index.ts` | May need minor edits for adapter registration |

## Files NOT to touch

- `src/cli/index.ts` — Prateek owns this
- `src/core/compression.ts` — Prateek owns this
- `src/core/prompt-builder.ts` — Prateek owns this
- `src/core/token-estimator.ts` — Prateek owns this
- `tests/core/*` — Prateek owns these
- `tests/e2e/*` — Prateek owns these

---

## Reference: How Claude Code adapter does it

Look at `src/adapters/claude-code/adapter.ts` for patterns to follow:
- Streaming JSONL parsing with `readline.createInterface()`
- File change extraction from tool_use blocks (Write/Edit)
- Integration with `analyzeConversation()` and `extractProjectContext()`
- Building the full `CapturedSession` object
- Error handling (malformed lines, missing files)

## When You're Done

```bash
# Verify
npx tsc --noEmit
npx vitest run

# Smoke test (if you have Cursor/Codex installed)
npx tsx src/cli/index.ts detect
npx tsx src/cli/index.ts list

# Push
git add -A
git commit -m "feat: Cursor and Codex adapters with full test coverage"
git push -u origin feat/cursor-codex-adapters
gh pr create --base main --title "feat: Cursor and Codex adapters (v0.2)"
```

Tell Prateek so he can review and merge.
