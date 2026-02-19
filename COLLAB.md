# AgentRelay — Collaboration Guide

## Current Status (Updated Feb 19, 2026)

MVP pipeline is **working end-to-end**. Both PRs merged to main.

| Milestone | Status |
|-----------|--------|
| PR #1 — Core engine (Prateek) | Merged |
| PR #2 — Data layer (Kushal) | Merged |
| End-to-end `handoff` command | Working |
| CI (GitHub Actions) | Running on Node 18/20/22 |
| Tests | 29 passing (22 core + 7 adapter) |

### What works now

```bash
npx tsx src/cli/index.ts detect          # detects Claude Code
npx tsx src/cli/index.ts info            # shows agent registry
npx tsx src/cli/index.ts list            # lists real sessions
npx tsx src/cli/index.ts handoff         # full pipeline, writes .handoff/RESUME.md + clipboard
```

### Bugs found during testing

1. **No project context in RESUME.md** — git branch shows "unknown", no directory tree, no CLAUDE.md contents. `extractProjectContext()` is implemented but never called during capture/handoff.
2. **Task description is garbage** — grabs the first user message blindly. If it's an interrupted message or "yes", the task description is useless.
3. **Decisions and blockers always empty** — adapter sets `decisions: []` and `blockers: []`. Nobody extracts these from conversation content.

---

## Team

| Who | Role | Next Branch |
|-----|------|-------------|
| **Prateek** | Core engine + CLI | `feat/enrich-pipeline` |
| **Kushal** | Data layer + smart extraction | `feat/smart-extraction` |

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
git checkout -b feat/smart-extraction   # (Kushal)
git checkout -b feat/enrich-pipeline    # (Prateek)

# Work, commit frequently
git add <files> && git commit -m "description"

# Push your branch
git push -u origin feat/smart-extraction
git push -u origin feat/enrich-pipeline

# Create PR to main
gh pr create --base main --title "feat: description"

# Before merging second PR, rebase on main
git pull origin main --rebase
```

## File Ownership (Round 2)

These files are **shared** — coordinate before editing:
- `src/types/index.ts` — if you need to change an interface, tell the other person
- `package.json` — if you need a new dependency, add it and tell the other person

| Prateek's files (don't touch) | Kushal's files (don't touch) |
|-------------------------------|------------------------------|
| `src/core/compression.ts` | `src/adapters/claude-code/adapter.ts` |
| `src/core/token-estimator.ts` | `src/core/project-context.ts` |
| `src/core/prompt-builder.ts` | `src/core/conversation-analyzer.ts` (new) |
| `src/cli/index.ts` | `tests/adapters/claude-code.test.ts` |
| `tests/core/*` | `tests/fixtures/*` |
| `tests/e2e/*` | |

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

# Check output
cat .handoff/RESUME.md

# Test built version
npm run build
node dist/cli/index.js detect
```
