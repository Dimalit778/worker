# Court Guard Scheduler - Claude Code Instructions

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
- Do not run commands unless explicitly asked.
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

## Shared project worktree policy

Follow @AGENTS.md and @docs/worktree-development.md. Their worktree setup permission overrides the general “do not run commands” rule above. Schema mutations still require fresh explicit human approval.
