<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Court Guard Scheduler - AI Agent Instructions

Single source of truth for all AI tools (Claude Code, Codex, Cursor). `CLAUDE.md` imports this file; do not duplicate rules elsewhere.

## Stack

- Next.js App Router
- TypeScript
- Prisma + PostgreSQL
- shadcn/ui
- Hebrew RTL UI
- Feature-based folder structure

## General rules

- Keep changes small and focused.
- Do not rewrite unrelated code.
- Do not scan the whole repository unless explicitly asked.
- Do not read `node_modules`, `.next`, generated files, lock files, or `.env` files unless explicitly asked.
- Do not add new libraries unless explicitly asked.
- Prefer simple, readable TypeScript.

## Token-saving rules

- Use token-saving mode by default.
- Inspect only the files relevant to the task.
- Before inspecting many files, explain why and ask first.
- Do not run commands unless explicitly asked (exception: the pre-authorized setup in "Worktree development policy").
- Do not paste long command outputs; summarize only the relevant errors.

## Database rules

- Do not run destructive database commands.
- Never run `prisma migrate reset` unless explicitly asked.
- Do not change the Prisma schema unless the task explicitly requires it.
- If schema changes are needed, explain the reason before editing.
- Use existing Prisma enums and model names when possible.

## Next.js rules

- Keep Prisma/database code on the server side.
- Do not import Prisma Client into client components.
- Use server actions where they fit the existing project style.
- Keep route protection consistent with the existing auth system.

## UI rules

- Keep Hebrew labels in UI.
- Preserve RTL layout.
- Use existing shadcn/ui components.
- Do not redesign screens unless explicitly asked.

## Scheduling domain rules

- Scheduling periods are 7 or 14 days.
- Employees submit availability before a period is locked.
- Managers generate, review, and publish schedules.
- Hard constraints must be respected before fairness scoring.
- Capacity is per court, day, shift type, and position.
- Avoid double-booking employees.
- Avoid invalid consecutive shifts.
- Fairness should consider total shifts, weekend shifts, and opening duties.
- Complete weekly minimums (2 MORNING + 1 EVENING per active employee) before assigning extras, across all weeks present in the period.
- Minimum completion takes priority over balancing adjacent shifts; preserve locked assignments and all hard constraints.
- Balance extra assignments separately by shift type and total extras, subject to availability and staffing needs.
- Evaluate only existing weeks (one for 7 days, two independently for 14 days), and calculate warnings from final assignments.
- Follow [docs/scheduling-priorities.md](docs/scheduling-priorities.md) for the detailed automatic scheduling priorities.

## Workflow

Before editing:

- Explain a short plan.
- Mention which files need to be inspected.
- Avoid broad repo scans.

When editing:

- Change only files relevant to the task.
- Prefer small patches.
- Do not perform unrelated cleanup.

After editing:

- Summarize what changed.
- List changed files.
- Mention if typecheck/lint should be run.

## Git Workflow Rules

- Work on only one task per branch.
- Never implement multiple unrelated tasks in the same branch.
- Start each task from the latest main branch.
- Create a new descriptive branch for every task, such as `fix/shift-publication`.
- Prefer a separate Git worktree for each task.
- Never modify main directly.
- After implementation, run relevant tests and review the diff.
- Commit changes with clear commit messages.
- Keep changes local by default. Push a branch only when the user explicitly requests a push or a Pull Request.
- Create a GitHub Pull Request only when the user explicitly requests one; task completion and GitHub access are not authorization to create a PR.
- Never merge Pull Requests automatically.
- Wait for explicit user confirmation before starting the next task.
- After the previous PR is merged, synchronize main before creating the next branch.
- Never discard uncommitted changes or delete worktrees without verifying they are safe to remove.

## Worktree development policy

- Every linked Git worktree must get its own ready-to-review development environment. This applies to Codex, Claude Code, Cursor and manually created worktrees.
- On entry/creation run `node scripts/worktree.mjs prepare`. This is pre-authorized for dependency installation, local environment files and Prisma client generation; setup hooks must never apply migrations.
- Run the project launcher (`pnpm worktree:dev`, also used by `pnpm dev` in a worktree). It provisions a dedicated local PostgreSQL cluster per worktree, owns its data directory and credentials, uses application port 3001 by default (or an explicit `--port`), selects a free database port, and creates synthetic demo accounts. If the requested application port is busy, stop with an error instead of selecting another port. Never copy the main `.env` or reuse a main/production database.
- Applying the worktree's EXISTING migrations to its own isolated database is pre-approved for agents (human approval given 2026-10-19), so agents can run and open the app for verification. Run `pnpm worktree:dev`; if it stops for schema approval, rerun it with `--approve-schema=<fingerprint>` using the fingerprint it prints for this exact checkout. This applies only when the schema/migration files are unchanged by the agent. Setup hooks must still never apply migrations.
- Ask the human BEFORE editing schema or migration files, or running any other schema mutation (including `db:push`, reset, or new migrations), even on the isolated database. Explain the concrete changes and target worktree and wait for explicit approval.
- Never run `db:push`, reset, migrations or schema-changing SQL against the main/production database. Do not bypass the Prisma guard or pass external database URLs. Keep `.worktree-dev` and environment files out of Git.
- At task completion prepare/verify the environment, report any pending schema approval honestly, and give ONE copyable command with the absolute worktree path: `cd '/absolute/worktree/path' && pnpm worktree:dev`, plus the verified browser URL. Do not claim a server is running if it is not.
- Follow [docs/worktree-development.md](docs/worktree-development.md) for setup, approval, ports and lifecycle. New worktrees must start from a commit that contains this tooling; do not promise old refs will inherit it automatically.
