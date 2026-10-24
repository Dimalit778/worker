# Court Guard Scheduler

Hebrew RTL scheduling system for court security staffing. Built with Next.js (App Router), TypeScript, Prisma + PostgreSQL and shadcn/ui.

## Development

```sh
pnpm dev
```

In a linked Git worktree, `pnpm dev` runs `pnpm worktree:dev`, which uses a dedicated local PostgreSQL cluster, managed environment and its own port (3001 by default). The first run asks for explicit approval before applying schema migrations to that isolated database, then prints the browser URL and demo credentials. Node.js 22.12+, pnpm and PostgreSQL binaries are required. See [the worktree guide](docs/worktree-development.md).

## More documentation

- [AGENTS.md](AGENTS.md) — rules for AI agents working on the project
- [GIT-WORKFLOW.md](GIT-WORKFLOW.md) — Git and Prisma workflow
- [DEPLOYMENT.md](DEPLOYMENT.md) — Vercel deployment and migrations
- [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) — product context and design system
- [docs/](docs) — architecture, scheduling and operational notes
