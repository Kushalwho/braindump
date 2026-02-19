# AgentRelay

A CLI tool that captures your AI coding agent session and generates a portable resume prompt so you can seamlessly continue in a different agent when tokens run out.

## The Problem

AI coding agents are context silos. When your session hits a rate limit or runs out of tokens, you lose all that context. AgentRelay captures it and generates a handoff prompt so a new agent can pick up exactly where the last one left off.

## Supported Agents

| Agent | Status |
|-------|--------|
| Claude Code | MVP |
| Cursor | Planned (v0.2) |
| Codex CLI | Planned (v0.2) |

## Installation

```bash
npm install -g agentrelay
```

## Quick Start

```bash
# Detect installed agents
agentrelay detect

# Full handoff — capture, compress, generate resume prompt
agentrelay handoff

# List recent sessions
agentrelay list
```

## Commands

| Command | Description |
|---------|-------------|
| `agentrelay detect` | Scan for installed AI coding agents |
| `agentrelay list` | List recent sessions |
| `agentrelay capture` | Capture a session to `.handoff/session.json` |
| `agentrelay handoff` | Full pipeline: capture → compress → resume |
| `agentrelay watch` | Background watcher for rate limit detection |
| `agentrelay resume` | Re-generate resume from captured session |
| `agentrelay info` | Show agent paths and config |

## How It Works

1. **Capture** — Reads your agent's native session storage (JSONL, SQLite, etc.)
2. **Normalize** — Converts to a portable session format
3. **Compress** — Priority-layered compression to fit any context window
4. **Generate** — Builds a self-summarizing resume prompt
5. **Deliver** — Writes to `.handoff/RESUME.md` and copies to clipboard

Paste the resume prompt into your target agent and it continues exactly where you left off.

## Development

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev -- detect

# Run tests
npm test

# Build
npm run build
```

## Architecture

```
src/
├── adapters/          # One per agent (Claude Code, Cursor, Codex)
├── core/              # Compression engine, token estimator, project context
├── providers/         # Output delivery (file, clipboard, agent-specific)
├── types/             # TypeScript interfaces
└── cli/               # Commander.js CLI entry point
```

## License

MIT
