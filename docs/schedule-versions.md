# Schedule versions: original and current

`Schedule` represents the period and submission window. `publishedVersionId` selects the current published version visible to employees; `draftVersionId` selects the manager's editable draft before first publication. SQL composite foreign keys prevent references to another period/facility, and a partial unique index prevents multiple drafts.

## Publication and the original snapshot

At first publication, `Schedule.originalVersionId` points to a separate immutable snapshot (reserved version number 0). The existing draft becomes the current published version, selected by `publishedVersionId`. Publication validates the draft, snapshots its staffing requirements, freezes the original, and records an audit event; the snapshot copy and publication commit in one transaction.

## Editing after publication

Manual saves and approved shift transfers update the current version in place and increment its `revision`. They do not create versions, republish the schedule, or change its original publication timestamp/capacity snapshot. New correction drafts are no longer opened after publication; a pre-existing correction draft may still be finished once. Initial preparation is still edited/generated before publication.

Every mutation rechecks the authenticated manager's current permission and facility, then compares the version ID and revision under the existing facility transaction lock. Stale operations require a refresh and are not retried.

Published slot IDs and their date/shift/position/slot-number identity remain stable. Clearing an assignment sets `userId` to null instead of deleting the row, preserving references from employee requests. Transfer approval rechecks the current assignee; a cleared or reassigned slot cannot be transferred using an outdated request.

## Audit and immutability

Each changed cell has its own `ScheduleChange` entry with the manager, time, employee names, date, shift, position, previous/new assignment, hours and lock state. Manual-rule violations and transfer request IDs are included when applicable. Unchanged cells are not copied into audit payloads.

The manager's current roster includes an expandable, read-only original roster and the change history below it. SQL triggers reject changes to the original, to published version metadata and slots (including moves into published versions), and to the change history; PostgreSQL enforces this for writes through any application path. Facilities and employees referenced by published history cannot be hard deleted. Older historical versions remain; no legacy data is purged.

## Migrations

The schedule-version migrations backfilled the original from the earliest retained published version and preserved all existing versions, live slot IDs, open drafts, requests and audit payloads. Do not use `db:push` instead of migrations: the backfill, triggers and partial index are required. Apply migrations through the approved deployment workflow (`pnpm db:deploy`, see `DEPLOYMENT.md`) before running new application code, and avoid rolling deployments that mix old and new code. Worktree verification uses only its own isolated PostgreSQL cluster.

## Validation

Use a dedicated localhost PostgreSQL database whose name ends in `_test`:

```sh
DATABASE_URL="$TEST_DATABASE_URL" pnpm db:deploy
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build
```

Set `TEST_DATABASE_URL` before testing. The migration regression test also requires `psql` on PATH and creates/drops its own isolated schema. CI provisions PostgreSQL and runs the integration tests rather than skipping them. Integration fixtures are synthetic and never use the configured project database.

Coverage includes draft privacy, publication, failure rollback, concurrency, stale writes, facility/permission enforcement, SQL immutability, version reference integrity, generation/locks, capacity snapshots, history deduplication, cache isolation, and migration of populated pre-version tables.
