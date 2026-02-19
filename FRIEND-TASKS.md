# AgentRelay — Friend's Task Sheet

## Your Branch: `feat/data-layer`

```bash
git clone https://github.com/Kushalwho/agentrelay.git
cd agentrelay
npm install
git checkout -b feat/data-layer
```

Read `AGENTRELAY-PRD.md` for full context. Read `COLLAB.md` for coordination rules.

---

## Your Scope

You own the **data layer** — everything that reads raw agent data and produces the universal `CapturedSession` format, plus delivering the final output to file/clipboard.

## Tasks (in order)

### Task 1: Claude Code Adapter — `detect()` and `listSessions()`

**File:** `src/adapters/claude-code/adapter.ts`

Implement:
- `detect()` — Check if `~/.claude/projects/` exists and has `.jsonl` files. Return `true`/`false`.
- `listSessions(projectPath?)` — Scan `~/.claude/projects/` for session files. If `projectPath` is given, convert it to the hash format (replace `/` with `-`) and look in that subfolder. Return `SessionInfo[]` sorted by most recent.

Key details:
- Path hash: `/home/user/my-project` becomes `-home-user-my-project`
- Each `.jsonl` file = one session. Filename is `<session-uuid>.jsonl`
- Read first line for timestamp + preview, last line for `lastActiveAt`
- Count lines for `messageCount`
- Use `fs` and `path` modules, no external deps needed
- Use `glob` package (already in deps) to find `.jsonl` files

### Task 2: Claude Code Adapter — `capture()` and `captureLatest()`

**File:** `src/adapters/claude-code/adapter.ts`

Implement:
- `capture(sessionId)` — Find the session file, parse JSONL line by line, build a `CapturedSession`
- `captureLatest(projectPath?)` — Call `listSessions()`, take the first result, call `capture()`

JSONL parsing rules (see PRD Section 9.2):
- Each line is one JSON object with `type`, `message`, and `timestamp`
- Extract text from `message.content` blocks where `type === "text"`
- Extract tool names from blocks where `type === "tool_use"`
- Extract file changes from `Write`/`Edit` tool_use blocks (`input.path` and `input.content`)
- Extract token counts from `message.usage`
- Skip malformed lines (wrap JSON.parse in try/catch)
- Handle incomplete last line (active sessions)

For `task`, `decisions`, and `blockers` fields — set reasonable defaults:
```typescript
task: {
  description: messages[0]?.content || "Unknown task",  // first user message
  completed: [],
  remaining: [],
  inProgress: messages[messages.length - 1]?.content?.substring(0, 200),
  blockers: [],
}
```

### Task 3: Adapter Registry — `detectAgents()` and `autoDetectSource()`

**File:** `src/adapters/index.ts`

Implement:
- `detectAgents()` — Run `detect()` on each adapter, collect results as `DetectResult[]`
- `autoDetectSource(projectPath?)` — Find the adapter whose most recent session is newest

For MVP, only Claude Code adapter will return `true` from `detect()`. Cursor and Codex stubs will return `false`.

### Task 4: Project Context Extractor

**File:** `src/core/project-context.ts`

Implement `extractProjectContext(projectPath)`:
- `gitBranch` — Run `git branch --show-current` in the project dir
- `gitStatus` — Run `git status --short`
- `gitLog` — Run `git log --oneline -10`, split into string array
- `structure` — Run `find . -maxdepth 2 -not -path '*/node_modules/*' -not -path '*/.git/*'` or use a tree-like approach. Cap at 40 lines.
- `name` — Try reading `package.json` name, fallback to directory basename
- `memoryFileContents` — Read `CLAUDE.md` and/or `.claude/CLAUDE.md` if they exist. Truncate at 2000 chars.

Use `child_process.execSync` for git commands. Wrap in try/catch — all fields are optional.

### Task 5: File Provider

**File:** `src/providers/file-provider.ts`

Implement `deliver(content, options?)`:
- Determine project path from `options.projectPath` or `process.cwd()`
- Create `.handoff/` directory if it doesn't exist (`fs.mkdirSync` with `recursive: true`)
- Write content to `.handoff/RESUME.md`
- Also write the raw session data to `.handoff/session.json` if available

### Task 6: Clipboard Provider

**File:** `src/providers/clipboard-provider.ts`

Implement `deliver(content, options?)`:
- Use `clipboardy` package (already in deps) to copy content
- `import clipboard from 'clipboardy'` then `clipboard.writeSync(content)`
- Wrap in try/catch — clipboard may not be available in all environments (SSH, headless)
- If clipboard fails, log a warning but don't throw

### Task 7: Provider Registry

**File:** `src/providers/index.ts`

Implement `getProviders(target)`:
- `"file"` → return `[FileProvider]`
- `"clipboard"` → return `[ClipboardProvider]`
- Any agent ID or default → return `[FileProvider, ClipboardProvider]` (belt and suspenders)

### Task 8: Test Fixtures

**File:** `tests/fixtures/claude-code-session.jsonl`

Create a realistic sample Claude Code session (10-15 lines) that your adapter can parse. Follow the format from PRD Appendix A. Include:
- 2-3 user messages
- 2-3 assistant messages with tool_use blocks
- At least one Write tool_use (file change)
- At least one Read tool_use
- Token usage fields

Then update `tests/adapters/claude-code.test.ts` to test against this fixture.

---

## Dependencies You Can Add

If you need something not in `package.json`, add it and note it in your PR:
- You should NOT need anything beyond what's already there for these tasks

## When You're Done

```bash
git add -A
git commit -m "Implement data layer: Claude Code adapter, project context, providers"
git push -u origin feat/data-layer
gh pr create --base main --title "feat: data layer - adapter, context, providers"
```

Tell Kushal so he can review and merge before wiring the CLI.
