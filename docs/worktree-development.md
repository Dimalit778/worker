# Isolated worktree development

From any linked worktree, run one command:

```sh
pnpm worktree:dev
```

`pnpm dev` also uses this launcher when Git detects a linked worktree. In the main checkout it preserves the original Next.js development command and does not provision or migrate a database. No application schema or migration files are edited by setup.

Requirements: Node.js 22.12+, pnpm, and local PostgreSQL binaries (`initdb`, `pg_ctl`, `psql`, `createdb`). On macOS install PostgreSQL once with `brew install postgresql@16`; no global PostgreSQL service is needed. On Linux use your distribution's PostgreSQL package. Set `WORKTREE_PG_BIN` if the binaries are elsewhere. Native Windows is not supported; use WSL with PostgreSQL installed there.

## What happens automatically

1. Detect the actual Git worktree/common directory; no Codex/Claude/Cursor-specific path assumptions.
2. Install frozen dependencies inside the checkout, including known native build prerequisites. Never symlink another checkout's node_modules.
3. Create private `.worktree-dev` state and managed `.env.local` with unique database credentials, auth secret and localhost URL. An existing regular `.env.local` is backed up privately before replacement; symlinked files are refused. The main `.env`/`.env.local` are never copied. Optional additional non-database settings can be placed explicitly in `.env.worktree.local` in the main checkout. DB/auth/port overrides in that template are ignored.
4. Generate the Prisma client. Setup hooks stop here, report pending schema approval, and never mutate database schema.
5. When you run the launcher, it asks you to type `APPLY` before applying migrations. Consent is bound to this checkout and a hash of schema/migration contents. Changed schema or migrations require a new approval. In unattended execution, it fails closed. Agents may use `--approve-schema=<full fingerprint>` only after the human explicitly approves that worktree and schema fingerprint.
6. After approval, initialize a dedicated password-protected PostgreSQL cluster in `.worktree-dev/postgres`, bind it only to loopback, and create its dedicated database. This does not use a shared local PostgreSQL service or any external database URL. Apply existing migrations, detect missing migrations with a read-only diff, and create synthetic demo data. No `db push`, reset or production clone is performed.
7. Find a free app port, update auth configuration and launch Next.js. Database data persists across restarts; stop the app with Ctrl+C. Run `pnpm worktree:stop` to stop its PostgreSQL process before archiving/deleting a worktree. Deleting `.worktree-dev` deletes only this worktree's local data and loses its demo credentials/consent.

The terminal prints the URL and local-only manager/employee credentials. Demo accounts are `manager@worktree.test` and `employee@worktree.test`, with password `12345` (also stored in `.worktree-dev/state.json`). The demo includes a published upcoming roster for testing corrections in two browser sessions.

Prisma's config additionally checks a linked worktree's target database against its local state. Inherited `DATABASE_URL` or `DIRECT_URL` values pointing elsewhere are refused. Schema commands require the launcher's matching explicit consent. Do not bypass this guard, and ask the human before editing schema/migration files or performing schema mutations.

## Agent integrations

- **Codex desktop:** `.codex/environments/environment.toml` registers the setup script and a Run action. If the app does not select it automatically, choose this project's local environment once in project settings. CLI/manual worktrees follow `AGENTS.md` and can use the same setup command.
- **Claude Code:** `.claude/settings.json` runs the safe preparation hook at session start and after `EnterWorktree`. Hook input `cwd` selects the actual checkout; `CLAUDE_PROJECT_DIR` may still point to the original project. The shared policy is included from `CLAUDE.md`. If Git worktrees are made manually through Bash, follow AGENTS.md and run setup explicitly.
- **Cursor:** `.cursor/worktrees.json` runs preparation on worktree creation, and an always-applied project rule loads the shared policy.

These are versioned project files. Commit/review/merge them onto the branch used to create future worktrees. A worktree checked out from an older commit cannot inherit files that were not present in that commit. Existing worktrees must receive the tooling changes first. No global user settings or main-branch code are silently modified.

At the end of each task the agent must give an absolute, copyable command and the verified URL, for example:

```sh
cd '/absolute/path/to/worktree' && pnpm worktree:dev
```

Use `pnpm worktree:status` to inspect the URL and schema readiness. Use `pnpm worktree:setup` for preparation without schema mutation. Preparation/server locks prevent concurrent launchers in one checkout; different worktrees have independent state, credentials, clusters and ports. Re-running the launch command reuses an already-running verified server. Ports are checked immediately before use; if a different process grabs one in the remaining OS race, startup fails and a rerun chooses again. Existing servers are never killed to claim a port.

## Verification and references

`pnpm test:worktree` verifies worktree detection (including spaces), database isolation, stale schema approvals, busy-port selection and safe tool hooks without database schema changes. Launching and signing into the demo tests the full path after explicit approval.

Official integration references: [Codex local environments](https://learn.chatgpt.com/docs/environments/local-environment), [Claude Code hooks](https://code.claude.com/docs/en/hooks), [Cursor worktrees](https://cursor.com/docs/configuration/worktrees).
