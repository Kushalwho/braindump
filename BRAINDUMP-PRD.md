# Braindump — Product Requirements Document

## One-Liner

A CLI tool that captures your AI coding agent session and generates a portable resume prompt so you can seamlessly continue in a different agent when tokens run out.

---

## Table of Contents

1. Problem Statement
2. Product Vision
3. User Stories & Flows
4. Core Concepts
5. Architecture
6. Detailed Technical Spec
7. Data Formats
8. CLI Interface Design
9. Adapter Specs (Claude Code, Cursor, Codex)
10. Compression Engine Spec
11. Watcher (Always-On) Spec
12. Resume Prompt Engineering
13. File & Directory Conventions
14. MVP Scope & Milestones
15. Future Roadmap
16. Open Questions & Decisions

---

## 1. Problem Statement

Every developer using AI coding agents (Claude Code, Cursor, OpenAI Codex CLI) hits this wall:

1. You're deep in a session — 30-100+ messages, multi-file changes, complex debugging
2. Tokens run out, rate limit hits, or session crashes
3. You want to continue in a different agent (or a fresh session of the same agent)
4. You spend 15-30 minutes manually re-explaining context, re-sharing files, re-making decisions
5. The new agent second-guesses previous decisions, wastes time, or goes in a different direction

The root cause: **AI coding agents are context silos.** Each stores conversations in proprietary formats (JSONL, SQLite, internal APIs) with zero interoperability. There is no standard way to export a session from one agent and import it into another.

Existing tools that touch this space:
- `claude-conversation-extractor` — exports Claude Code sessions to markdown, but that's it. No compression, no resume generation, no multi-agent support.
- `cursor-history` — reads Cursor's SQLite DB, but only for viewing/backup. No handoff capability.
- `ccmanager` — manages multiple Claude Code sessions in parallel, but doesn't transfer context between different agents.
- `ccs` — switches between agent accounts/providers, but doesn't carry session context.
- Various `/handoff` custom commands — agent-specific, manual, and don't work cross-agent.

**Nobody has built the full pipeline: capture → compress → generate resume prompt → deliver to a different agent.**

---

## 2. Product Vision

### What Braindump Is

A developer CLI tool (`npm install -g braindump`) that:
1. Reads session data from any supported agent's native storage
2. Converts it into a universal portable format
3. Compresses it intelligently using priority layers to fit any context window
4. Generates a **self-summarizing resume prompt** — a prompt that, when pasted into the target agent, instructs that agent to internalize the context and immediately continue the task
5. Delivers the prompt (clipboard, file, or opens the target agent)

### What Braindump Is NOT

- Not a chat history viewer or backup tool
- Not an agent orchestrator or multi-agent framework
- Not a replacement for CLAUDE.md / AGENTS.md / .cursorrules
- Not a cloud service — everything runs locally, nothing leaves the machine

### Design Principles

1. **Zero config to start.** `braindump handoff` should work with no setup on any machine that has at least one supported agent installed.
2. **The target agent does the heavy lifting.** We don't host or run a summarization model. We structure the raw context so the target agent can self-summarize as its first action (Option 2 strategy).
3. **Graceful degradation.** If we can't read a session perfectly, output whatever we can. Partial context is infinitely better than no context.
4. **Read-only on agent data.** We NEVER write to or modify any agent's native storage. All our output goes to `.handoff/` in the project directory.
5. **Adapter pattern.** Adding support for a new agent should require implementing one interface file, not modifying core logic.

---

## 3. User Stories & Flows

### Story 1: Reactive Handoff (Most Common)

> As a developer, when my Claude Code session hits the rate limit mid-task, I want to run one command and continue my work in Cursor immediately.

**Flow:**
```
Developer is coding in Claude Code on project /home/user/my-app
  ↓
Rate limit hits. Terminal shows "You've exceeded your usage limit"
  ↓
Developer runs: braindump handoff
  ↓
Braindump:
  1. Auto-detects that Claude Code was the most recently active agent
  2. Finds the latest session for the current project directory
  3. Reads the JSONL session file from ~/.claude/projects/
  4. Extracts: messages, file changes, tool calls, errors
  5. Reads project context: git status, directory tree, CLAUDE.md
  6. Compresses everything into priority layers
  7. Generates a self-summarizing resume prompt
  8. Writes to .handoff/RESUME.md
  9. Copies to clipboard
  ↓
Developer opens Cursor, pastes into Composer
  ↓
Cursor's agent reads the resume prompt, internalizes the context,
and continues exactly where Claude Code left off.
```

### Story 2: Proactive Watch Mode

> As a developer, I want Braindump running in the background so that when a rate limit hits, the handoff context is already prepared.

**Flow:**
```
Developer runs: braindump watch (in a separate terminal tab)
  ↓
Braindump watches ~/.claude/projects/, ~/.codex/sessions/,
and Cursor's workspaceStorage for file changes
  ↓
When session files are modified, Braindump:
  - Tracks which sessions are active
  - Periodically snapshots the watcher state to .handoff/watcher-state.json
  - Scans the tail of session files for rate-limit error patterns
  ↓
Rate limit detected! Braindump prints:
  "⚠️  Rate limit detected in claude-code! Run 'braindump handoff' to switch."
  ↓
Developer runs: braindump handoff
  ↓
(Same as Story 1 from step 3 onward, but faster because the watcher
already knows which session was active)
```

### Story 3: Explicit Session Selection

> As a developer, I want to handoff a specific older session, not just the most recent one.

**Flow:**
```
Developer runs: braindump list
  ↓
Output:
  📂 claude-code:
     a1b2c3d4e5f6  Feb 19, 2:30 PM (47 msgs)
     └─ Building nutrition tracking with FatSecret API
     f7e8d9c0b1a2  Feb 18, 11:00 AM (23 msgs)
     └─ Setting up Supabase auth with RLS
  📂 cursor:
     8h7j6k5l:comp-uuid  Feb 19, 1:00 PM (12 msgs)
     └─ Fixing dark mode toggle bug
  ↓
Developer runs: braindump handoff --session a1b2c3d4e5f6
```

### Story 4: Cross-Project Handoff

> As a developer, I was working on project A in Claude Code and want to continue in Codex, which needs the same context.

**Flow:**
```
braindump handoff --source claude-code --project /mnt/d/better --target codex
```

---

## 4. Core Concepts

### Portable Session Format

The central data structure. Every adapter converts its native format INTO this, and every provider consumes FROM this. It captures:

- **Project context:** path, name, git branch/status, directory tree, memory file contents (CLAUDE.md, AGENTS.md, etc.)
- **Conversation:** messages with roles (user/assistant/tool), timestamps, token estimates
- **File changes:** paths, diffs, change types (created/modified/deleted)
- **Task state:** what the user is trying to do, what's done, what's left, what's actively in progress
- **Decisions:** key choices made during the session (so the new agent doesn't re-debate them)
- **Blockers:** errors and issues encountered

### Adapters (Input)

One adapter per agent. Each adapter knows:
- Where the agent stores its data (varies by OS)
- How to parse the native format (JSONL, SQLite, etc.)
- How to extract messages, file changes, and tool calls from that format

Adapters implement the `AgentAdapter` interface.

### Compression Engine

Takes a Portable Session and compresses it to fit a token budget. Uses priority layers — critical context is never dropped, nice-to-have context is included only if there's room.

### Resume Prompt

The final output. A carefully structured markdown document designed to be pasted into any AI agent. It uses the **self-summarizing strategy**: instead of pre-summarizing with a separate model, the prompt instructs the target agent to internalize the raw context and continue working.

### Providers (Output)

Providers handle delivery of the resume prompt:
- **File:** Write to `.handoff/RESUME.md`
- **Clipboard:** Copy to system clipboard
- **Agent-specific:** Tailored formatting + launch instructions for specific agents

### Watcher

A background process that monitors agent session files for changes. Provides:
- Active session tracking
- Rate limit detection (via pattern matching on session file contents)
- Instant handoff readiness

---

## 5. Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER'S MACHINE                          │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Claude Code   │  │   Cursor     │  │  Codex CLI   │      │
│  │ (Terminal)    │  │   (IDE)      │  │  (Terminal)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│  ~/.claude/projects/  workspaceStorage/  ~/.codex/sessions/ │
│  [JSONL files]        [SQLite DBs]       [JSONL files]      │
│         │                  │                  │              │
│         └──────────┐       │       ┌──────────┘              │
│                    ▼       ▼       ▼                         │
│              ┌─────────────────────────┐                     │
│              │     ADAPTER LAYER       │                     │
│              │                         │                     │
│              │ ClaudeCodeAdapter       │                     │
│              │ CursorAdapter           │                     │
│              │ CodexAdapter            │                     │
│              └───────────┬─────────────┘                     │
│                          │                                   │
│                          ▼                                   │
│              ┌─────────────────────────┐                     │
│              │   PORTABLE SESSION      │                     │
│              │   (Normalized JSON)     │                     │
│              └───────────┬─────────────┘                     │
│                          │                                   │
│              ┌───────────▼─────────────┐                     │
│              │  COMPRESSION ENGINE     │                     │
│              │                         │                     │
│              │  Priority Layer Packing │                     │
│              │  Token Budget Fitting   │                     │
│              │  Self-Summarize Prompt  │                     │
│              └───────────┬─────────────┘                     │
│                          │                                   │
│              ┌───────────▼─────────────┐                     │
│              │   PROVIDER LAYER        │                     │
│              │                         │                     │
│              │  .handoff/RESUME.md     │                     │
│              │  Clipboard              │                     │
│              │  Agent-specific launch  │                     │
│              └─────────────────────────┘                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  WATCHER (Optional)                  │    │
│  │  Monitors session files → Detects rate limits       │    │
│  │  Maintains .handoff/watcher-state.json              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
braindump/
├── src/
│   ├── adapters/
│   │   ├── index.ts                 # Adapter registry + auto-detection
│   │   ├── base-adapter.ts          # Shared adapter utilities
│   │   ├── claude-code/
│   │   │   └── adapter.ts           # JSONL parser for ~/.claude/projects/
│   │   ├── cursor/
│   │   │   └── adapter.ts           # SQLite reader for state.vscdb
│   │   └── codex/
│   │       └── adapter.ts           # JSONL parser for ~/.codex/sessions/
│   ├── core/
│   │   ├── registry.ts              # Agent metadata, storage paths per OS
│   │   ├── compression.ts           # Priority-layered compression engine
│   │   ├── token-estimator.ts       # Token counting utilities
│   │   ├── project-context.ts       # Git, directory tree, memory files
│   │   ├── prompt-builder.ts        # Self-summarizing resume prompt assembly
│   │   └── watcher.ts               # File watcher for always-on mode
│   ├── providers/
│   │   ├── index.ts                 # Provider registry
│   │   ├── file-provider.ts         # Writes .handoff/RESUME.md
│   │   ├── clipboard-provider.ts    # Copies to system clipboard
│   │   └── agent-provider.ts        # Agent-specific formatting + launch
│   ├── types/
│   │   └── index.ts                 # All TypeScript interfaces
│   └── cli/
│       └── index.ts                 # Commander.js CLI entry point
├── tests/
│   ├── fixtures/                    # Sample session files for testing
│   │   ├── claude-code-session.jsonl
│   │   ├── codex-session.jsonl
│   │   └── cursor-state.vscdb       # (or mock data)
│   ├── adapters/
│   │   ├── claude-code.test.ts
│   │   ├── cursor.test.ts
│   │   └── codex.test.ts
│   ├── core/
│   │   ├── compression.test.ts
│   │   └── prompt-builder.test.ts
│   └── e2e/
│       └── handoff-flow.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
├── LICENSE (MIT)
└── README.md
```

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Language | TypeScript | Target audience is JS/TS devs, npm distribution |
| Runtime | Node.js ≥18 | Stable, widely installed, needed for npm -g |
| CLI Framework | Commander.js | Standard, lightweight, great DX |
| SQLite | better-sqlite3 | Synchronous, fast, needed for Cursor adapter |
| File Watching | chokidar | Cross-platform, battle-tested |
| Clipboard | clipboardy | Cross-platform clipboard access |
| Token Estimation | Character-based heuristic (4 chars ≈ 1 token) | No external deps, accurate enough for budgeting |
| File Search | glob | Find session files across nested directories |
| Spinner/UI | ora | Nice CLI spinners during capture |
| Testing | vitest | Fast, TypeScript-native |
| Build | tsc | Simple, no bundler needed for CLI tool |

### Dependencies (Keep Minimal)

```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "chalk": "^5.3.0",
    "chokidar": "^4.0.0",
    "clipboardy": "^4.0.0",
    "commander": "^12.0.0",
    "glob": "^11.0.0",
    "ora": "^8.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vitest": "^1.3.0"
  }
}
```

---

## 6. Detailed Technical Spec

### 6.1 Agent Storage Locations (Verified via Research)

#### Claude Code

```
Storage: ~/.claude/projects/<path-hash>/<session-uuid>.jsonl
Index:   ~/.claude/history.jsonl (global session index, metadata only)

Path hash: project absolute path with / replaced by -
  /home/user/my-project → -home-user-my-project

JSONL format: one JSON object per line, each line is one conversation turn.
Each entry has:
{
  "type": "human" | "assistant",
  "message": {
    "role": "user" | "assistant",
    "content": [
      { "type": "text", "text": "..." },
      { "type": "tool_use", "name": "Write", "input": { "path": "...", "content": "..." } },
      { "type": "tool_result", "content": "..." }
    ],
    "usage": { "input_tokens": N, "output_tokens": N }
  },
  "timestamp": "2025-02-19T10:30:00Z"
}

Memory file: CLAUDE.md (in project root, or .claude/CLAUDE.md)
Also reads: .claude/settings.json, .claude/settings.local.json

Default cleanup: 30 days (configurable via cleanupPeriodDays in settings)

Platform paths (all the same since it's a CLI tool):
  macOS:  ~/.claude/projects/
  Linux:  ~/.claude/projects/
  Windows/WSL: ~/.claude/projects/
```

#### Cursor

```
Storage: <app-data>/Cursor/User/workspaceStorage/<workspace-hash>/state.vscdb
Global:  <app-data>/Cursor/User/globalStorage/state.vscdb

Platform paths:
  macOS:   ~/Library/Application Support/Cursor/User/workspaceStorage/
  Linux:   ~/.config/Cursor/User/workspaceStorage/
  Windows: %APPDATA%/Cursor/User/workspaceStorage/

Each workspace-hash folder contains:
  - state.vscdb (SQLite database)
  - workspace.json (maps hash back to project path, format: { "folder": "file:///path/to/project" })

SQLite schema:
  CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT);

Relevant keys (try in priority order):
  1. "composer.composerData" → JSON with allComposers array (modern format)
  2. "workbench.panel.aichat.view.aichat.chatdata" → legacy chat storage
  3. "composerData:<composerId>" → individual session metadata
  4. "bubbleId:<composerId>:<bubbleId>" → individual messages

Modern composer format:
{
  "allComposers": [
    {
      "type": "chat",
      "composerId": "uuid-string",
      "name": "Conversation Title",
      "createdAt": 1732619305658,
      "lastUpdatedAt": 1732697065798
    }
  ]
}

Individual messages (bubble) format:
{
  "role": "user" | "assistant",
  "text": "message content",
  "type": "user" | "ai",
  ...
}

Also check cursorDiskKV table in some versions.

Memory file: .cursorrules (project root), or .cursor/rules/*.mdc

IMPORTANT: Open database in READ-ONLY mode to avoid conflicts with running Cursor.
```

#### OpenAI Codex CLI

```
Storage: ~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<session-id>.jsonl
Config:  ~/.codex/config.toml
Memory:  AGENTS.md (project root, or ~/.codex/AGENTS.md for global)

JSONL format: event-based, one event per line.
Events include:
  - User messages
  - Assistant responses
  - Tool calls (file writes, bash commands)
  - Tool results
  - Token usage statistics
  - Plan steps

Common entry shapes:
{
  "role": "user" | "assistant" | "developer",
  "content": "..." | [{ "type": "text", "text": "..." }, { "type": "output_text", "text": "..." }],
  "timestamp": "...",
  "usage": { "input_tokens": N, "output_tokens": N }
}

Tool call entries:
{
  "type": "tool_call" | "function_call",
  "name": "write_file" | "shell" | "read_file" | ...,
  "input": { "path": "...", "content": "..." },
  "output": "..."
}

Platform paths:
  macOS:  ~/.codex/sessions/
  Linux:  ~/.codex/sessions/
  Windows/WSL: ~/.codex/sessions/

Session resume: codex resume --last or codex resume <SESSION_ID>
```

### 6.2 Token Estimation

We use a simple character-based heuristic: **1 token ≈ 4 characters** for English text. This is accurate enough for budget planning (typically within 10-15% of actual tokenizer output).

Known context windows:
```
claude-code (Opus/Sonnet): 200,000 tokens
cursor (varies by model):   32,000 - 128,000 tokens (use 64,000 as default)
codex (GPT-5.3-Codex):     200,000 tokens
universal (safe default):    32,000 tokens
```

Usable context for resume: **60% of total window.** The remaining 40% is reserved for system prompts, tool definitions, and the agent's own responses.

```
claude-code usable: ~120,000 tokens
cursor usable:      ~38,000 tokens
codex usable:       ~120,000 tokens
universal usable:   ~19,000 tokens
```

---

## 7. Data Formats

### 7.1 Portable Session Format (session.json)

This is the universal intermediate format. Every adapter produces this, every provider consumes this.

```typescript
interface CapturedSession {
  version: "1.0";
  source: "claude-code" | "cursor" | "codex";
  capturedAt: string; // ISO 8601
  sessionId: string;
  sessionStartedAt?: string;

  project: {
    path: string;               // Absolute path to project root
    name?: string;              // From package.json, Cargo.toml, etc.
    gitBranch?: string;
    gitStatus?: string;         // Output of git status --short
    gitLog?: string[];          // Last 10 commits (oneline)
    structure?: string;         // Directory tree (depth 2)
    memoryFileContents?: string; // Combined CLAUDE.md + AGENTS.md + .cursorrules
  };

  conversation: {
    messageCount: number;
    estimatedTokens: number;
    summary?: string;           // Only if pre-generated (we don't do this in v1)
    messages: {
      role: "user" | "assistant" | "system" | "tool";
      content: string;
      toolName?: string;        // e.g., "Write", "Bash", "Read"
      timestamp?: string;
      tokenCount?: number;
    }[];
  };

  filesChanged: {
    path: string;
    changeType: "created" | "modified" | "deleted";
    diff?: string;              // Content or diff
    language?: string;          // Inferred from extension
  }[];

  decisions: string[];          // Key choices made during session
  blockers: string[];           // Errors and issues encountered

  task: {
    description: string;        // What the user is trying to accomplish
    completed: string[];        // Steps done
    remaining: string[];        // Steps left
    inProgress?: string;        // What was actively being worked on
    blockers: string[];
  };
}
```

### 7.2 Watcher State (.handoff/watcher-state.json)

```typescript
interface WatcherState {
  timestamp: string;
  agents: string[];             // Which agents are being watched
  activeSessions: {
    [filePath: string]: number; // file path → last modified timestamp
  };
}
```

### 7.3 Resume Output (.handoff/RESUME.md)

See Section 12 for the full prompt engineering spec.

---

## 8. CLI Interface Design

### Commands

```
braindump detect
  Scans for installed agents.
  Output: list of detected agents with ✅/❌ status.

braindump list [--source <agent>] [--limit <n>]
  Lists recent sessions across detected agents.
  Default: all agents, 10 sessions.
  Output: session ID, timestamp, message count, preview.

braindump capture [--source <agent>] [--session <id>] [--project <path>]
  Captures a session into .handoff/session.json.
  Auto-detects source if not specified (most recently modified session).
  Output: session stats + file path.

braindump handoff [--source <agent>] [--target <agent|clipboard|file>] [--session <id>] [--project <path>] [--tokens <n>]
  Full pipeline: capture + compress + generate resume + deliver.
  This is the primary command most users will run.
  Default target: file (writes .handoff/RESUME.md) + clipboard.

braindump watch [--agents <csv>] [--interval <seconds>]
  Starts background watcher. Monitors session files.
  Alerts on rate limit detection.
  Writes periodic snapshots to .handoff/watcher-state.json.

braindump resume [--target <agent>] [--tokens <n>] [--file <path>]
  Generates resume prompt from a previously captured session.json.
  Useful for re-generating with different target/token budget.

braindump info
  Shows agent storage paths, context window sizes, and config.
```

### CLI UX Rules

1. Always show a spinner during capture/compression (use `ora`).
2. Use color sparingly: green for success, yellow for warnings, red for errors.
3. On `handoff`, always copy to clipboard AND write to file. Belt and suspenders.
4. Show token stats after every operation (estimated tokens in resume vs target budget).
5. If auto-detection picks a source, always tell the user which it picked and why.
6. Session IDs can be shortened to first 8-12 chars for display (but accept full or partial for input).

### Exit Codes

```
0 = success
1 = no agents detected
2 = session not found
3 = capture/parse error
4 = compression error (shouldn't happen, but just in case)
```

---

## 9. Adapter Specs

### 9.1 Adapter Interface

Every adapter must implement:

```typescript
interface AgentAdapter {
  agentId: string;

  // Check if this agent is installed and has session data
  detect(): Promise<boolean>;

  // List available sessions, optionally filtered by project path
  listSessions(projectPath?: string): Promise<SessionInfo[]>;

  // Capture a specific session by ID
  capture(sessionId: string): Promise<CapturedSession>;

  // Capture the most recent session (optionally for a specific project)
  captureLatest(projectPath?: string): Promise<CapturedSession>;
}

interface SessionInfo {
  id: string;
  startedAt?: string;
  lastActiveAt?: string;
  messageCount?: number;
  projectPath?: string;
  preview?: string; // First user message or title, truncated to ~120 chars
}
```

### 9.2 Claude Code Adapter

**Detection:** Check if `~/.claude/projects/` exists and contains any `.jsonl` files.

**List sessions:**
1. If projectPath given: convert to hash format (replace / with -), look in that specific subfolder
2. If no projectPath: scan all subfolders
3. For each .jsonl file: read first line for timestamp + preview, read last line for lastActiveAt, count lines for messageCount
4. Sort by lastActiveAt descending

**Capture session:**
1. Read the JSONL file line by line
2. For each line, parse JSON and extract:
   - Text content from message.content array (filter blocks where type === "text")
   - Tool names from blocks where type === "tool_use"
   - File changes from Write/Edit/Create tool_use blocks (extract input.path and input.content)
   - Errors from tool_result blocks or text containing error patterns
   - Token counts from message.usage
3. Build ConversationMessage array
4. Deduplicate file changes (keep latest per path)
5. Infer project path from directory hash
6. Call extractProjectContext() for git/tree/memory file data
7. Build and return CapturedSession

**Edge cases:**
- Malformed JSONL lines → skip silently
- Very large sessions (10k+ lines) → parse in streaming fashion, don't load entire file into memory
- Session files being actively written to → handle gracefully (incomplete last line)

### 9.3 Cursor Adapter

**Detection:** Check if the workspaceStorage directory exists for the current platform.

**List sessions:**
1. Scan all subdirectories of workspaceStorage
2. For each: check if state.vscdb exists
3. Open state.vscdb in READ-ONLY mode (`{ readonly: true, fileMustExist: true }`)
4. Try keys in priority order:
   a. `composer.composerData` → parse allComposers array
   b. `workbench.panel.aichat.view.aichat.chatdata` → parse legacy format
5. Read workspace.json to get project path mapping
6. Build SessionInfo for each composer, using `<workspace-hash>:<composerId>` as the session ID

**Capture session:**
1. Parse session ID into workspace-hash and composerId
2. Open the specific state.vscdb
3. Try to read individual messages via `bubbleId:<composerId>:*` keys
4. Fallback: read from `composerData:<composerId>` key
5. Parse each bubble/message into ConversationMessage
6. File changes: Cursor doesn't store diffs as cleanly as Claude Code. Extract what we can from message content (code blocks, file references).
7. Build CapturedSession

**Edge cases:**
- Database locked by Cursor → better-sqlite3 in readonly mode handles this
- Schema changes between Cursor versions → try multiple key patterns with fallbacks
- cursorDiskKV table vs ItemTable → check both
- Hashed workspace IDs → always resolve via workspace.json

### 9.4 Codex Adapter

**Detection:** Check if `~/.codex/sessions/` exists.

**List sessions:**
1. Glob for `~/.codex/sessions/**/*.jsonl` (they're nested by date: YYYY/MM/DD/)
2. For each file: parse filename for session ID, read first line for preview
3. Session filenames are like: `rollout-2025-01-22T10-30-00-abc123.jsonl`
4. Sort by file modification time descending

**Capture session:**
1. Find session file by ID
2. Parse JSONL: Codex entries can have different shapes:
   - Standard message: `{ role, content, timestamp, usage }`
   - Tool call: `{ type: "tool_call", name: "write_file", input: { path, content } }`
   - Some entries have nested `message` objects
3. Extract file changes from write_file/edit_file/shell tool calls
4. Extract project path from `cwd` field in entries
5. Build CapturedSession

**Edge cases:**
- `role: "developer"` → map to "system"
- Content can be string OR array of content blocks (same as OpenAI API format)
- Some entries might be internal events (telemetry, etc.) → filter by checking for role or type field

---

## 10. Compression Engine Spec

### Overview

The compression engine takes a CapturedSession and a token budget, and produces a resume prompt that fits within the budget. It uses a **priority-layered approach** where the most critical context is always included and less important context is added if there's room.

### Priority Layers

```
Priority 1 (ALWAYS included) — ~500 tokens
  TASK STATE: What you're building, what's done, what's in progress, what's left

Priority 2 (ALWAYS included if present) — ~2,000-5,000 tokens
  ACTIVE FILES: Diffs/content of files that were changed during the session
  Cap at 15 files, truncate individual diffs at 2000 chars

Priority 3 (ALWAYS included if present) — ~500 tokens
  DECISIONS & BLOCKERS: Key choices made + errors encountered
  This is CRITICAL for preventing the new agent from re-debating settled questions

Priority 4 (include if room) — ~1,000-2,000 tokens
  PROJECT CONTEXT: Git branch/status, directory tree (depth 2), memory file contents
  Truncate tree at 40 lines, memory file at 2000 chars

Priority 5 (include if room) — ~1,000-3,000 tokens
  SESSION OVERVIEW: Heuristic summary (first user message, last user message,
  message count, tools used, unique tool names)

Priority 6 (include if room) — ~5,000-15,000 tokens
  RECENT MESSAGES: Last 20 messages of the conversation
  Truncate individual messages at 1000 chars

Priority 7 (include if room) — unlimited
  FULL HISTORY: All remaining older messages
  Truncate individual messages at 500 chars
```

### Packing Algorithm

```
1. Calculate token budget:
   budget = options.targetTokens || getUsableTokenBudget(targetAgent)

2. Build all layers (compute content + token count for each)

3. Reserve tokens for:
   - Header (~200 tokens) — always included
   - Footer / Resume Instructions (~200 tokens) — always included

4. Sort layers by priority (ascending)

5. For each layer:
   if (usedTokens + layer.tokens + reservedTokens <= budget):
     include layer fully
   else if (remaining budget > 200 AND priority <= 3):
     truncate layer to fit remaining budget
     include truncated version
   else:
     drop layer, record in droppedContent list

6. Assemble: header + included layers + footer = RESUME.md
```

### Token Budget Defaults

```
Target: clipboard / universal / file → 32,000 usable tokens (conservative)
Target: cursor → 38,000 usable tokens
Target: claude-code → 120,000 usable tokens
Target: codex → 120,000 usable tokens
Custom: --tokens flag overrides everything
```

---

## 11. Watcher (Always-On) Spec

### What It Watches

| Agent | Watch Pattern | Method |
|-------|--------------|--------|
| Claude Code | `~/.claude/projects/**/*.jsonl` | chokidar file watcher |
| Codex | `~/.codex/sessions/**/*.jsonl` | chokidar file watcher |
| Cursor | `workspaceStorage/**/state.vscdb` | chokidar file watcher |

### Behavior

1. On start: scan for installed agents, set up watchers for each
2. On file change: debounce (2 second window), then:
   - Record the file path + timestamp in activeSessions map
   - Check the tail of the file (last 5 lines) for rate-limit patterns
3. On rate limit detection: print alert to terminal with suggestion to run `braindump handoff`
4. Every `snapshotInterval` seconds (default 30): write watcher-state.json

### Rate Limit Detection Patterns

```regex
/rate.?limit/i
/too.?many.?requests/i
/429/
/quota.?exceeded/i
/token.?limit/i
/usage.?limit/i
/capacity/i
/overloaded/i
```

### Lifecycle

- Start: `braindump watch`
- Runs until Ctrl+C (SIGINT) or SIGTERM
- On shutdown: write final snapshot, close all watchers
- Does NOT daemonize in v1 (runs in foreground)

---

## 12. Resume Prompt Engineering (Option 2 — Self-Summarizing)

This is the most important section. The resume prompt is the actual product output. Its quality determines whether the handoff feels seamless or frustrating.

### Strategy: Self-Summarizing Prompt

Instead of using a separate model to summarize the session, we structure the raw context in a way that instructs the TARGET agent to:
1. Read and internalize the provided context silently
2. NOT repeat or summarize what it read back to the user
3. Immediately continue working on the task

This works because the target agent (Sonnet, GPT-5.3, etc.) is highly capable and can process structured context efficiently.

### RESUME.md Template

```markdown
# 🔄 Braindump — Session Handoff

> **Source:** {source_agent_name} → **Captured:** {timestamp}
> **Project:** {project_name} ({project_path}) | Branch: `{git_branch}`

---

## ⚡ Instructions for Resuming Agent

You are continuing a task that was started in a previous {source_agent} session.
The previous session ended (likely due to token/rate limits).

**Your job:**
1. Read ALL the context below carefully and silently internalize it
2. Do NOT summarize what you read back to the user
3. Do NOT re-debate any decisions listed in "Key Decisions"
4. Do NOT re-introduce yourself or ask if the user wants to continue
5. Pick up EXACTLY where the previous agent left off
6. Your first action should be to continue the in-progress work described below

---

## Current Task

**Goal:** {task_description}

**✅ Completed:**
{completed_items}

**🔧 In Progress (continue this immediately):**
{in_progress_description}

**⏳ Remaining:**
{remaining_items}

---

## Key Decisions — Do NOT Re-Debate These

These decisions were made during the previous session after careful consideration.
Accept them as given and build on them.

1. {decision_1}
2. {decision_2}
...

---

## Errors & Blockers Encountered

The previous agent ran into these issues. Avoid repeating them.

- {blocker_1}
- {blocker_2}

---

## Files Changed

### {file_path_1} ({change_type})
```{language}
{diff_or_content}
```

### {file_path_2} ({change_type})
```{language}
{diff_or_content}
```

---

## Project Context

**Branch:** `{git_branch}`

**Git Status:**
```
{git_status_output}
```

**Project Structure:**
```
{directory_tree}
```

**Agent Memory File ({memory_file_name}):**
```
{memory_file_contents}
```

---

## Session Overview

- {message_count} messages exchanged
- ~{token_count} tokens used
- Tools used: {tool_names}

**Initial request:** {first_user_message_truncated}

**Most recent request:** {last_user_message_truncated}

---

## Recent Conversation (last {n} of {total} messages)

**USER:**
{message_content}

**ASSISTANT:**
{message_content}

**USER:**
{message_content}

...

---

## Resume Now

Continue the work described above. Start with {in_progress_or_next_task}.
Do not ask for confirmation. Do not summarize. Just continue building.
```

### Prompt Engineering Notes

1. **"Do NOT re-debate" is critical.** Without this, new agents waste 2-3 exchanges questioning previous decisions.
2. **"Do NOT summarize back" prevents the agent from wasting its first response** recapping everything it just read.
3. **"Pick up EXACTLY where left off" with specific next step** gives the agent a clear entry point.
4. **Decisions section uses numbered list** because agents treat numbered items as more authoritative.
5. **Blockers section prevents repeated failures.** If the previous agent discovered an OAuth 1.0a requirement, the new one shouldn't try OAuth 2.0 again.
6. **Recent messages provide conversation tone and flow** so the new agent matches the interaction style.

---

## 13. File & Directory Conventions

### .handoff/ Directory

All Braindump output goes here. Located in the project root (same level as package.json).

```
.handoff/
├── RESUME.md              # The resume prompt (regenerated each handoff)
├── session.json           # Raw captured session data
└── watcher-state.json     # Watcher snapshot (when watch mode is active)
```

### .gitignore Recommendation

Add `.handoff/` to .gitignore. Session data may contain sensitive info (API keys in logs, etc.).

### Config File

`~/.braindump/config.json` (global, optional):

```json
{
  "defaultTokenBudget": 32000,
  "watcher": {
    "snapshotInterval": 30,
    "agents": ["claude-code", "cursor", "codex"]
  },
  "customPaths": {}
}
```

---

## 14. MVP Scope & Milestones

### MVP (v0.1.0) — Ship This First

**Goal:** `braindump handoff` works end-to-end for Claude Code → anything.

Must have:
- [x] Portable session format (types)
- [ ] Claude Code adapter (capture from JSONL)
- [ ] Token estimator (character-based)
- [ ] Project context extractor (git, tree, memory files)
- [ ] Compression engine (priority layers, no LLM)
- [ ] Self-summarizing prompt builder
- [ ] File provider (writes .handoff/RESUME.md)
- [ ] Clipboard provider
- [ ] CLI: `detect`, `handoff`, `list`
- [ ] Works on macOS and Linux (WSL counts as Linux)

Nice to have but can skip:
- Cursor adapter (SQLite adds complexity)
- Codex adapter
- Watch mode
- Agent-specific providers
- Config file support

### v0.2.0 — Multi-Agent

- [ ] Cursor adapter (SQLite reader)
- [ ] Codex adapter (JSONL reader)
- [ ] CLI: `capture`, `resume`, `info`
- [ ] Agent-specific resume formatting (Cursor vs Codex vs Claude Code)
- [ ] Windows native support (non-WSL)

### v0.3.0 — Always-On

- [ ] Watcher mode
- [ ] Rate limit detection
- [ ] `braindump watch` command
- [ ] Snapshot management

### v0.4.0 — Polish

- [ ] Config file support (~/.braindump/config.json)
- [ ] Test suite with fixtures
- [ ] NPM publish
- [ ] README with GIFs/videos
- [ ] GitHub Actions CI

---

## 15. Future Roadmap (Post-MVP)

These are ideas for after initial traction. Do not build these for v1.

1. **LLM-powered summarization (Optional Enhancement):**
   - Ollama local model for pre-summarization
   - API call to cheap model (Haiku, GPT-4o-mini) using user's existing API key
   - Only as opt-in: `braindump handoff --summarize`

2. **Memory file sync:**
   - Auto-sync CLAUDE.md ↔ AGENTS.md ↔ .cursorrules
   - Use symlinks or a canonical file with pointers

3. **MCP server mode:**
   - Expose braindump as an MCP tool that agents can call directly
   - Agent could run `braindump_capture` as a tool before session ends
   - This is the killer feature: the agent itself can trigger handoff

4. **VS Code extension:**
   - Cmd+Shift+P → "Braindump: Handoff"
   - Works inside Cursor since it's VS Code-based

5. **Browser extension:**
   - For Claude.ai and ChatGPT web interfaces
   - Captures visible conversation from the DOM
   - Hardest to build, lowest priority

6. **Team handoffs:**
   - Share .handoff/RESUME.md with teammates
   - Include git patch files alongside resume
   - Useful for async code review or pair programming handoffs

7. **Session analytics:**
   - Track token usage patterns across agents
   - Suggest optimal agent switches based on task type
   - "You tend to hit rate limits at 3pm — consider switching to Codex after lunch"

---

## 16. Open Questions & Decisions

### Q1: Should we support capturing from Claude.ai web (not Claude Code)?
**Decision: No for v1.** Claude.ai web doesn't store conversations locally in an accessible format. Would require a browser extension. Defer.

### Q2: Should .handoff/ be gitignored by default?
**Decision: Yes.** Session data may contain sensitive information. Users can opt to commit it if they want, but default should be private.

### Q3: What happens if the session JSONL is being written to (active session)?
**Decision: Read what's available.** JSONL is append-only, so reading while it's being written is safe — we just might miss the last partial line. Catch JSON parse errors on the last line and skip it.

### Q4: Should we detect the target agent automatically?
**Decision: No for v1.** Default to file + clipboard. Let the user decide where to paste. Auto-launching agents adds complexity and platform-specific edge cases.

### Q5: Package name on npm?
**Options:** `agentrelay`, `agent-relay`, `handoff-cli`, `ctxport`, `agentswitch`
**Decision: Check npm availability and pick. `agentrelay` is preferred.**

### Q6: Should we read Cursor's globalStorage in addition to workspaceStorage?
**Decision: Yes.** Some composer metadata (like the list of composers) is in globalStorage, while actual messages are in workspaceStorage. Need both for complete coverage.

### Q7: How do we handle the Cursor adapter on machines where Cursor is running?
**Decision:** better-sqlite3 in readonly mode (`{ readonly: true }`) is safe for concurrent access. Cursor writes to the DB, we only read. No conflicts.

---

## Appendix A: Sample Claude Code JSONL Entry

```json
{"type":"human","message":{"role":"user","content":[{"type":"text","text":"Add error handling to the API route in src/api/nutrition.ts"}]},"timestamp":"2025-02-19T10:30:00Z"}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I'll add comprehensive error handling to the nutrition API route."},{"type":"tool_use","id":"toolu_01","name":"Read","input":{"path":"src/api/nutrition.ts"}},{"type":"tool_result","tool_use_id":"toolu_01","content":"export async function GET(req: Request) {\n  const query = new URL(req.url).searchParams.get('q');\n  const results = await searchFood(query);\n  return Response.json(results);\n}"}],"usage":{"input_tokens":1523,"output_tokens":847}},"timestamp":"2025-02-19T10:30:05Z"}
```

## Appendix B: Sample Cursor SQLite Query

```sql
-- Read modern composer list
SELECT value FROM ItemTable WHERE key = 'composer.composerData';

-- Read individual messages for a composer
SELECT key, value FROM ItemTable WHERE key LIKE 'bubbleId:COMPOSER_UUID:%';

-- Read legacy chat data
SELECT value FROM ItemTable WHERE key = 'workbench.panel.aichat.view.aichat.chatdata';

-- Get workspace mapping
-- (Read from workspace.json file, not from DB)
```

## Appendix C: Sample Codex JSONL Entry

```json
{"role":"user","content":"Fix the race condition in the payment webhook handler","timestamp":"2025-02-19T10:00:00Z","cwd":"/home/user/my-app"}
{"role":"assistant","content":[{"type":"text","text":"I'll analyze the webhook handler for race conditions."},{"type":"tool_call","name":"read_file","input":{"path":"src/webhooks/payment.ts"}}],"usage":{"input_tokens":2000,"output_tokens":500}}
{"type":"tool_result","name":"read_file","output":"export async function handlePaymentWebhook(req) { ... }"}
```
