# Published schedules and correction drafts

`Schedule` represents the period and submission window. `publishedVersionId` selects the immutable version visible to employees; `draftVersionId` selects the manager's editable draft. A correction copies all slots to a new `ScheduleVersion` with new slot IDs, preserving assignees, times, notes, assignment sources and locks. Opening or editing that draft leaves the published pointer and period status unchanged.

Publication validates the draft, snapshots its staffing requirements, freezes it, switches the published pointer, clears the draft pointer and records an audit event in one transaction. Previous published versions remain available as history. Employee roster reads, employee assignment statistics and engine history/boundary checks use only the selected published version. Draft saves update only draft query caches, and stale responses cannot overwrite another version.

Every mutation rechecks the authenticated manager's current permission and facility, then compares the version ID and revision under the existing facility transaction lock. SQL composite foreign keys prevent references to another period/facility; a partial unique index prevents multiple drafts. SQL triggers reject changes/deletion of published version metadata and slots, including moves into published versions. Facilities/employees referenced by published history cannot be hard deleted.

## Migration and deployment

Deploy `20261016180000_schedule_versions` with the matching application release. The old application expects `Schedule.revision` and cannot run against the new schema. Stop old application instances/writes during the migration and release switch; do not use a rolling deployment that mixes old and new code.

The migration creates version 1 for every existing schedule, moves its revision token to the version, preserves slot IDs and all submission/audit payloads, and sets the applicable draft/published pointer. Existing audit rows attach to the imported version; earlier versions cannot be reconstructed from the previous schema. Current requirements provide the initial staffing snapshot for existing data. If a correction was already opened before migration, the old schema has already overwritten its published state; this migration preserves that draft and cannot recover the earlier roster. Restore that roster from a verified backup if it is needed.

After deployment, use `pnpm db:generate`; do not use `db:push` instead of the migration, because backfill, triggers and the partial index are required. No deployment or migration against a project/live database was performed during implementation.

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

Coverage includes initial draft privacy, current/upcoming roster visibility during correction, republication, previous-version retention, failure rollback, concurrency, stale writes, facility/permission enforcement, SQL immutability, version reference integrity, generation/locks, capacity snapshots, history deduplication, cache isolation, and migration of populated pre-version tables.
