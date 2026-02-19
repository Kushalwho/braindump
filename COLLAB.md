# AgentRelay — Collaboration Guide

## Team

| Who | Branch | Focus Area |
|-----|--------|------------|
| **You (Kushal)** | `feat/core-engine` | Compression, prompt builder, token estimator, CLI wiring |
| **Friend** | `feat/data-layer` | Claude Code adapter, project context, providers (file + clipboard) |

## The Contract: `CapturedSession`

Both sides meet at the `CapturedSession` interface in `src/types/index.ts`. This is the handshake:

- **Friend** builds adapters that **produce** `CapturedSession` objects from raw agent data
- **Kushal** builds the engine that **consumes** `CapturedSession` objects and outputs RESUME.md

Neither side needs the other's code to work. Use test fixtures to mock the interface.

## Branch Workflow

```bash
# Create your feature branch
git checkout -b feat/core-engine   # (Kushal)
git checkout -b feat/data-layer    # (Friend)

# Work, commit frequently
git add <files> && git commit -m "description"

# Push your branch
git push -u origin feat/core-engine
git push -u origin feat/data-layer

# When ready, create a PR to main
gh pr create --base main --title "Add core engine" --body "..."

# Before merging the second PR, rebase on main
git checkout feat/data-layer
git pull origin main --rebase
```

## Avoiding Conflicts

These files are **shared** — coordinate before editing:
- `src/types/index.ts` — if you need to change an interface, tell the other person
- `src/cli/index.ts` — Kushal owns this, friend should not edit
- `package.json` — if you need a new dependency, add it and tell the other person

These files are **owned** — no conflicts possible:

| Kushal's files (don't touch) | Friend's files (don't touch) |
|------------------------------|------------------------------|
| `src/core/compression.ts` | `src/adapters/claude-code/adapter.ts` |
| `src/core/token-estimator.ts` | `src/adapters/index.ts` |
| `src/core/prompt-builder.ts` | `src/core/project-context.ts` |
| `src/cli/index.ts` | `src/providers/file-provider.ts` |
| `tests/core/*` | `src/providers/clipboard-provider.ts` |
| `tests/e2e/*` | `src/providers/index.ts` |
| | `tests/adapters/claude-code.test.ts` |
| | `tests/fixtures/*` |

## Communication

When you finish a chunk of work:
1. Push your branch
2. Tell the other person what you changed
3. If you modified `src/types/index.ts`, flag it explicitly

## Testing Without the Other Half

**Kushal (core engine):** Create a mock `CapturedSession` in your tests:
```typescript
const mockSession: CapturedSession = {
  version: "1.0",
  source: "claude-code",
  capturedAt: new Date().toISOString(),
  sessionId: "test-123",
  project: { path: "/home/user/my-app" },
  conversation: { messageCount: 5, estimatedTokens: 2000, messages: [...] },
  filesChanged: [{ path: "src/index.ts", changeType: "modified", diff: "..." }],
  decisions: ["Use Express over Fastify"],
  blockers: ["OAuth token refresh failing"],
  task: { description: "Build REST API", completed: ["Setup"], remaining: ["Auth"], blockers: [] },
};
```

**Friend (data layer):** Test your adapter by pointing it at fixture files in `tests/fixtures/`. Create sample JSONL files that mimic real Claude Code sessions.
