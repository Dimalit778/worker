# Scheduling architecture

The application is a Next.js modular monolith using Prisma/PostgreSQL and a pure TypeScript scheduler (`src/features/scheduling-engine`). Server actions authenticate the current database identity on every call; cached loaders never perform permission checks (see [data-caching.md](data-caching.md)).

## Structure and roles

- Hierarchy: `District` → `Facility`; every `User` belongs to one facility (`User.facilityId`). `SystemRole` is `USER` or `ADMIN`.
- `Role.rank` (officer 1, shift manager 2, controller 3, guard 4; lower is higher) decides which positions an employee may fill (`Position.requiredRank`). Edit authority is a separate flag, `User.canEditSchedule`; a rank or label never grants it.
- A `Schedule` is a 7- or 14-day period with its own submission window. Each version is a `ScheduleVersion` and each assignment a `ScheduleSlot`. Versions, publication and corrections are described in [schedule-versions.md](schedule-versions.md).

## Invariants

- Automatic generation follows the [minimum-first scheduling priorities](scheduling-priorities.md).
- Only submitted availability counts. Missing or `UNAVAILABLE` slots block assignment; `PREFERRED` is a soft preference. An empty submission is valid. Every availability save checks the opening and closing timestamps.
- Provenance (`AssignmentSource`: `MANUAL`/`AUTOMATIC`) is separate from `isLocked`. Regeneration replaces all unlocked assignments, including manual ones; lock an assignment to preserve it. The UI confirms this before regeneration.
- Every mutation carries `{ versionId, revision }`. Facility locking, serializable transactions and an in-transaction permission and facility check coordinate writes, validation and audit. Stale or conflicting operations require a refresh and are not blindly retried.
- Shared validation covers active employees, rank, availability, capacity, rest and adjacent schedules. Deleting or unlocking can repair an invalid draft; a final full validation is mandatory at publication.
- Fairness considers the current published version of neighbouring schedules in the preceding 56 days plus the working draft. Historical assignments influence ordering but are not counted in the draft's totals.
- Warnings and fairness figures are derived from the final assignments of a version. Published assignments and the change history are protected by SQL triggers; audit entries are append-only.
- Tenant isolation relies on application authorization and composite foreign keys, not on database row-level security. Do not expose the database directly to clients. `pnpm db:check-rls` only reports the connection's role and RLS flags.

## Deployment and verification

Run `pnpm db:generate` and `pnpm db:deploy` against the intended database. Migrations include handwritten partial indexes and triggers, so `db push` does not install the invariants. Vercel does not run migrations (see [DEPLOYMENT.md](../DEPLOYMENT.md)).

Run `pnpm typecheck`, `pnpm lint`, `pnpm test:run` and `pnpm build`. PostgreSQL integration tests need a disposable local `_test` database via `TEST_DATABASE_URL` and are skipped without it; see the validation steps in [schedule-versions.md](schedule-versions.md).
