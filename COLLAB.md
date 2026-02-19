# AgentRelay — Collaboration Guide

## Current Status (Updated Feb 19, 2026)

**MVP v0.1 is complete.** All 4 PRs merged. Moving to **v0.2 (Multi-Agent)**.

| Milestone | Status |
|-----------|--------|
| PR #1 — Core engine (Prateek) | Merged |
| PR #2 — Data layer (Kushal) | Merged |
| PR #3 — Enrich pipeline (Prateek) | Merged |
| PR #4 — Smart extraction (Kushal) | Merged |
| End-to-end `handoff` command | Working |
| CI (GitHub Actions) | Running on Node 18/20/22 |
| Tests | 40 passing |

### What's working (MVP complete)

- Claude Code adapter — full JSONL parsing with streaming
- Conversation analyzer — task description, decisions, blockers, completed steps
- Project context enrichment — git branch/status/log, directory tree, memory files
- Compression engine — 7 priority layers, budget-aware packing
- Prompt builder — self-summarizing RESUME.md template
- CLI — all commands: `detect`, `list`, `capture`, `handoff`, `resume`, `info`
- File + clipboard delivery
- npm link works as global `agentrelay` command

### What's next (v0.2 — Multi-Agent)

Per PRD milestones:
- Cursor adapter (SQLite reader)
- Codex adapter (JSONL reader)
- E2E tests
- ora spinners for CLI UX
- Agent-specific resume formatting

---

## Team

| Who | Role | Round 3 Branch |
|-----|------|----------------|
| **Prateek** | Core engine + CLI + E2E tests | `feat/e2e-and-polish` |
| **Kushal** | Data layer + adapters | `feat/cursor-codex-adapters` |

## The Contract: `CapturedSession`

Both sides meet at the `CapturedSession` interface in `src/types/index.ts`.

- **Kushal** builds adapters that **produce** `CapturedSession` objects from raw agent data
- **Prateek** builds the engine that **consumes** `CapturedSession` objects and outputs RESUME.md

## Branch Workflow

```bash
# Always start from latest main
git checkout main
git pull origin main

# Create your feature branch
git checkout -b feat/cursor-codex-adapters   # (Kushal)
git checkout -b feat/e2e-and-polish          # (Prateek)

# Work, commit frequently
git add <files> && git commit -m "description"

# Push your branch
git push -u origin feat/cursor-codex-adapters
git push -u origin feat/e2e-and-polish

# Create PR to main
gh pr create --base main --title "feat: description"

# Before merging second PR, rebase on main
git pull origin main --rebase
```

## File Ownership (Round 3)

These files are **shared** — coordinate before editing:
- `src/types/index.ts` — if you need to change an interface, tell the other person
- `package.json` — if you need a new dependency, add it and tell the other person

| Prateek's files (don't touch) | Kushal's files (don't touch) |
|-------------------------------|------------------------------|
| `src/core/compression.ts` | `src/adapters/claude-code/adapter.ts` |
| `src/core/token-estimator.ts` | `src/adapters/cursor/adapter.ts` |
| `src/core/prompt-builder.ts` | `src/adapters/codex/adapter.ts` |
| `src/core/conversation-analyzer.ts` | `src/adapters/base-adapter.ts` |
| `src/cli/index.ts` | `src/adapters/index.ts` |
| `tests/core/*` | `src/core/project-context.ts` |
| `tests/e2e/*` | `tests/adapters/*` |
| | `tests/fixtures/*` |

## How to Test

```bash
# Pull latest
git pull origin main
npm install

# Run all tests
npm test

# Smoke test all commands
npx tsx src/cli/index.ts detect
npx tsx src/cli/index.ts info
npx tsx src/cli/index.ts list
npx tsx src/cli/index.ts handoff --source claude-code
npx tsx src/cli/index.ts handoff --source claude-code --tokens 5000

# Check output quality
cat .handoff/RESUME.md
# Verify: git branch correct, decisions populated, task description makes sense

# Test built version
npm run build
node dist/cli/index.js detect
```
