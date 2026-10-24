# Deployment

## Vercel

Use Vercel's Git integration for this project.

1. Push this repository to GitHub.
2. In Vercel, create a new project from the GitHub repository.
3. Keep the framework preset as Next.js.
4. Use `pnpm install --frozen-lockfile` as the install command.
5. Use `pnpm build` as the build command.
6. Add the required environment variables per environment.

## Environment Variables

Required for Production:

```txt
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

Recommended:

- Use a separate database for Preview deployments.
- Set `NEXTAUTH_URL` to the production domain in Production.
- Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`.

## Database

Production schema changes should use Prisma migrations:

```bash
pnpm db:deploy
```

Do not use `prisma db push` against Production.

Vercel does not run migrations. After merging a change that includes new migrations, run `pnpm db:deploy` manually against the Production database.

## Release Flow

1. Open a pull request.
2. Wait for GitHub Actions CI to pass.
3. Check the Vercel Preview Deployment.
4. Merge into `master`.
5. Vercel deploys Production from `master`.
6. If the change includes migrations, run `pnpm db:deploy` against Production.

Before merging, verify the core workflows in the Preview Deployment:

- Login
- Manager/admin/user redirects
- Period creation
- Availability submission
- Schedule generation
- Manual assignment edits
- Publish/finalize flow
