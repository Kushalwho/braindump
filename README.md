# AgentRelay

A CLI tool that captures your AI coding agent session and generates a portable resume prompt so you can seamlessly continue in a different agent when tokens run out.

## The Problem

AI coding agents are context silos. When your session hits a rate limit or runs out of tokens, you lose all that context. AgentRelay captures it and generates a handoff prompt so a new agent can pick up exactly where the last one left off.

## Supported Agents

| Agent | Status |
|-------|--------|
| Claude Code | Working (MVP) |
| Cursor | In progress (v0.2) |
| Codex CLI | In progress (v0.2) |

## Installation

```bash
# From source (current)
git clone https://github.com/Kushalwho/agentrelay.git
cd agentrelay
npm install
npm run build
npm link

# From npm (coming soon)
npm install -g agentrelay
```

## Quick Start

```bash
# Detect installed agents
agentrelay detect

# Full handoff — capture, compress, generate resume prompt
agentrelay handoff

# The resume prompt is in .handoff/RESUME.md and on your clipboard
# Paste it into your target agent and keep working
```

## Commands

```
agentrelay detect                         Scan for installed agents
agentrelay list [--source <agent>]        List recent sessions
agentrelay capture [--source <agent>]     Capture session to .handoff/session.json
agentrelay handoff [options]              Full pipeline: capture → compress → resume
agentrelay resume [--file <path>]         Re-generate resume from captured session
agentrelay info                           Show agent paths and config
```

### Handoff Options

```
-s, --source <agent>    Source agent (claude-code, cursor, codex). Auto-detected if omitted.
-t, --target <target>   Target agent or "file"/"clipboard". Default: file + clipboard.
--session <id>          Specific session ID. Default: most recent session.
-p, --project <path>    Project path. Default: current directory.
--tokens <n>            Token budget override. Default: based on target agent.
```

## How It Works

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
│  Claude Code    │    │   Capture    │    │   Compress      │    │  RESUME.md   │
│  JSONL session  │ -> │  + Normalize │ -> │  (7 priority    │ -> │  + clipboard │
│                 │    │              │    │   layers)       │    │              │
└─────────────────┘    └──────────────┘    └─────────────────┘    └──────────────┘
```

1. **Capture** — Reads Claude Code's JSONL session files from `~/.claude/projects/`
2. **Normalize** — Converts to a portable `CapturedSession` format
3. **Compress** — Priority-layered compression to fit any context window
4. **Generate** — Builds a self-summarizing resume prompt that tells the new agent to pick up exactly where the last one left off
5. **Deliver** — Writes to `.handoff/RESUME.md` and copies to clipboard

## Compression Priority Layers

| Priority | Layer | Always included? |
|----------|-------|-----------------|
| 1 | Task state (what's done, in progress, remaining) | Yes |
| 2 | Active files (diffs/content of changed files) | Yes |
| 3 | Decisions and blockers | Yes |
| 4 | Project context (git, directory tree, memory files) | If room |
| 5 | Session overview (stats, first/last message) | If room |
| 6 | Recent messages (last 20) | If room |
| 7 | Full history (older messages) | If room |

## Development

```bash
npm install              # Install dependencies
npm run dev -- detect    # Run in dev mode
npm test                 # Run tests (watch mode)
npm run test:run         # Run tests (single run)
npm run lint             # Type check
npm run build            # Build to dist/
```

## Project Structure

```
src/
├── adapters/                  # Agent-specific session readers
│   ├── claude-code/adapter.ts # JSONL parser for ~/.claude/projects/
│   ├── cursor/adapter.ts      # SQLite reader (planned)
│   └── codex/adapter.ts       # JSONL parser (planned)
├── core/
│   ├── compression.ts         # Priority-layered compression engine
│   ├── conversation-analyzer.ts # Extracts tasks, decisions, blockers
│   ├── prompt-builder.ts      # RESUME.md template assembly
│   ├── token-estimator.ts     # Character-based token estimation
│   ├── project-context.ts     # Git info, directory tree, memory files
│   ├── registry.ts            # Agent metadata (paths, context windows)
│   └── watcher.ts             # File watcher (planned)
├── providers/
│   ├── file-provider.ts       # Writes .handoff/RESUME.md
│   ├── clipboard-provider.ts  # Copies to system clipboard
│   └── agent-provider.ts      # Agent-specific formatting (planned)
├── types/index.ts             # All TypeScript interfaces
└── cli/index.ts               # Commander.js CLI entry point
```

## CI

GitHub Actions runs on every PR and push to main:
- TypeScript type check
- Tests (vitest)
- Build
- Node.js 18, 20, 22

## License

MIT
