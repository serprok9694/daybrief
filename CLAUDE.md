# daybrief

Personal "my day" dashboard: AI day brief, today's events, tasks, important emails and an idea to revisit. Long-term direction: a Jarvis-style assistant built on the same data layer.

## Read before any task

- `docs/PRD.md`: product decisions, architecture, data and privacy rules. Source of truth.
- `docs/design/README.md`: approved v1 design. Read before any UI task.
- `docs/milestones/`: the current milestone and its tasks (one task = one issue = one PR).
- `apps/app/AGENTS.md`: Expo specifics. Expo changes every SDK: check the versioned docs, not memory.

## Layout

```
apps/app        Expo (Expo Router, web + iOS + Android). Routes in src/app/
apps/api        Hono API, deployed on Vercel. src/routes.ts = routes, src/index.ts = Vercel entry (must import hono itself), src/dev.ts = local server
packages/core   Domain model and types shared by app, API and the future agent
packages/connectors  Google integrations: tokens in, core objects out
packages/ui     Design tokens and UI primitives (from docs/design)
packages/i18n   en/ru dictionaries and i18n setup
```

Workspace packages are consumed as TypeScript source (`main: src/index.ts`), no build step.

## Commands

Node 24 (`.nvmrc`), pnpm via corepack.

```bash
pnpm install
pnpm dev            # app on http://localhost:8081, API on http://localhost:8787
pnpm lint
pnpm typecheck
pnpm test
pnpm format         # prettier
pnpm --filter @daybrief/app build   # static web export to apps/app/dist
```

In `apps/app`, add dependencies with `pnpm expo install <pkg>` so versions match the Expo SDK.

## Rules

- TypeScript strict everywhere. No `any` without a comment explaining why.
- Logic gets tests (Vitest, colocated `*.test.ts`). Run lint, typecheck and test before declaring a task done; CI runs the same.
- Secrets only in env files and platform settings. Never in code, commits, logs or the client bundle. Only `EXPO_PUBLIC_*` values reach the app, and those must be public.
- v1 is read-only towards Google: no writes to Google APIs. Email bodies are never stored.
- UI strings only through i18n (en + ru) once `packages/i18n` exists (M0/T4). Colors, spacing and radii only through design tokens once `packages/ui` exists (M0/T3).
- Keep changes scoped to the task. Record product or architecture decisions in `docs/PRD.md` or `docs/adr/`.
