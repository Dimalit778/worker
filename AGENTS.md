<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Git Workflow Rules

- Work on only one task per branch.
- Never implement multiple unrelated tasks in the same branch.
- Start each task from the latest main branch.
- Create a new descriptive branch for every task, such as `fix/shift-publication`.
- Prefer a separate Git worktree for each task.
- Never modify main directly.
- After implementation, run relevant tests and review the diff.
- Commit changes with clear commit messages.
- Push the branch and create a GitHub Pull Request targeting main, if GitHub access is available.
- Never merge Pull Requests automatically.
- Wait for explicit user confirmation before starting the next task.
- After the previous PR is merged, synchronize main before creating the next branch.
- Never discard uncommitted changes or delete worktrees without verifying they are safe to remove.

## Worktree development policy

- Every linked Git worktree must get its own ready-to-review development environment. This applies to Codex, Claude Code, Cursor and manually created worktrees.
- On entry/creation run `node scripts/worktree.mjs prepare`. This is pre-authorized for dependency installation, local environment files and Prisma client generation; setup hooks must never apply migrations.
- Run the project launcher (`pnpm worktree:dev`, also used by `pnpm dev` in a worktree). It provisions a dedicated local PostgreSQL cluster per worktree, owns its data directory and credentials, selects free application/database ports, and creates synthetic demo accounts. Never copy the main `.env` or reuse a main/production database.
- Ask the human BEFORE editing schema or migration files, or executing schema mutations, even on the isolated database. Explain the concrete changes and target worktree. Only after explicit approval may you use the launcher's matching `--approve-schema=<fingerprint>` option; never infer approval from this setup policy or grant it from an unattended hook.
- Never run `db:push`, reset, migrations or schema-changing SQL against the main/production database. Do not bypass the Prisma guard or pass external database URLs. Keep `.worktree-dev` and environment files out of Git.
- At task completion prepare/verify the environment, report any pending schema approval honestly, and give ONE copyable command with the absolute worktree path: `cd '/absolute/worktree/path' && pnpm worktree:dev`, plus the verified browser URL. Do not claim a server is running if it is not.
- Follow [docs/worktree-development.md](docs/worktree-development.md) for setup, approval, ports and lifecycle. New worktrees must start from a commit that contains this tooling; do not promise old refs will inherit it automatically.
