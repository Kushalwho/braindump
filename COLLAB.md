# AgentRelay — Collaboration Guide

## Current Status (Updated Feb 19, 2026)

**v0.2.0 is shipped.** All adapters, watcher, CLI fully wired. Moving to **Round 5 (Polish, Hardening & npm Publish)**.

| Milestone | Status |
|-----------|--------|
| PR #1 — Core engine (Prateek) | Merged |
| PR #2 — Data layer (Kushal) | Merged |
| PR #3 — Enrich pipeline (Prateek) | Merged |
| PR #4 — Smart extraction (Kushal) | Merged |
| PR #5 — E2E tests, ora spinners, agent hints (Prateek) | Merged |
| PR #6 — Cursor & Codex adapters (Kushal) | Merged |
| PR #7 — `--dry-run`, version bump, resume fix (Prateek) | Merged |
| PR #8 — Watcher core with polling + rate-limit detection (Kushal) | Merged |
| PR #9 — Watch CLI wiring (Prateek) | Merged |
| End-to-end pipeline | **Working (all 3 agents)** |
| Watch command | **Working** |
| CI (GitHub Actions) | Running on Node 18/20/22 |
| Tests | **70 passing** |

### What's working (v0.2.0)

- **All 3 adapters:** Claude Code (JSONL), Cursor (SQLite), Codex (JSONL)
- **Watcher:** Polling-based session monitoring with rate-limit heuristics
- Conversation analyzer — task description, decisions, blockers, completed steps
- Project context enrichment — git branch/status/log, directory tree, memory files
- Compression engine — 7 priority layers, budget-aware packing
- Prompt builder — self-summarizing RESUME.md with agent-specific target hints
- CLI — all 7 commands with ora spinners: `detect`, `list`, `capture`, `handoff`, `watch`, `resume`, `info`
- `--dry-run` flag for handoff preview
- File + clipboard delivery
- E2E integration tests
- npm link works as global `agentrelay` command

### What's next (Round 5 — Polish, Hardening & npm Publish)

**Goal:** Harden adapters, add CLI quality-of-life flags, clean up dead code, expand test coverage, update docs, and publish to npm.

| Task | Owner | Branch |
|------|-------|--------|
| Session validation with Zod schemas | **Kushal** | `feat/validation` |
| Improve Cursor workspace resolution (glob fallback) | **Kushal** | `feat/validation` |
| Large session + edge case tests | **Kushal** | `feat/validation` |
| Remove dead code (`agent-provider.ts`, `chokidar` dep) | **Kushal** | `feat/validation` |
| Add `--no-clipboard` and `--output` flags | **Prateek** | `feat/cli-polish` |
| Add `--verbose` debug logging | **Prateek** | `feat/cli-polish` |
| Update README (watch docs, test count, remove "coming soon") | **Prateek** | `feat/cli-polish` |
| npm publish prep (package.json, LICENSE) | **Prateek** | `feat/cli-polish` |
| Bump version to v0.3.0 | **Prateek** | `feat/cli-polish` |

---

## Team

| Who | Role | Current Focus |
|-----|------|---------------|
| **Prateek** | Core engine + CLI + E2E tests | CLI polish, docs, npm publish |
| **Kushal** | Data layer + adapters + watcher | Validation, adapter hardening, cleanup |

## The Contract: `CapturedSession`

Both sides meet at the `CapturedSession` interface in `src/types/index.ts`.

- **Kushal** builds adapters/watcher that **produce** `CapturedSession` objects and monitor agent data
- **Prateek** builds the engine/CLI that **consumes** `CapturedSession` objects and outputs RESUME.md

## Branch Workflow

```bash
# Always start from latest main
git checkout main
git pull origin main

# Create your feature branch
git checkout -b feat/validation       # (Kushal)
git checkout -b feat/cli-polish       # (Prateek)

# Work, commit frequently
git add <files> && git commit -m "description"

# Push your branch
git push -u origin feat/validation
git push -u origin feat/cli-polish

# Create PR to main
gh pr create --base main --title "feat: description"

# Before merging second PR, rebase on main
git pull origin main --rebase
```

## File Ownership (Round 5)

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
| `src/providers/*` | `src/core/watcher.ts` |
| `tests/core/*` | `tests/adapters/*` |
| `tests/e2e/*` | `tests/watcher/*` |
| `README.md` | `tests/fixtures/*` |

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
npx tsx src/cli/index.ts handoff --source claude-code --dry-run
npx tsx src/cli/index.ts handoff --source claude-code --target cursor --tokens 5000
npx tsx src/cli/index.ts watch --interval 10

# Check output quality
cat .handoff/RESUME.md

# Test built version
npm run build
node dist/cli/index.js detect
```
