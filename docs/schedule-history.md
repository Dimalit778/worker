# Original and current schedules

At first publication, `Schedule.originalVersionId` points to a separate immutable snapshot (reserved version number 0). The existing draft becomes the current published version, selected by `publishedVersionId`. First publication and the snapshot copy commit in the same transaction.

After publication, manual saves and approved shift transfers update the current version in place and increment its `revision`. They do not create versions, republish the schedule, or change its original publication timestamp/capacity snapshot. Facility locking, optimistic revision checks and transaction rollback remain in effect. Initial preparation is still edited/generated before publication; new correction drafts are no longer opened after publication.

Each changed cell has its own `ScheduleChange` entry with the manager, time, employee names, date, shift, position, previous/new assignment, hours and lock state. Manual-rule violations and transfer request IDs are included when applicable. Unchanged cells are not copied into audit payloads. Previously recorded audit entries are retained as-is.

Published slot IDs and their date/shift/position/slot-number identity remain stable. Clearing an assignment sets `userId` to null instead of deleting the row, preserving references from employee requests. Transfer approval rechecks the current assignee; a cleared or reassigned slot cannot be transferred using an outdated request.

The manager's current roster includes an expandable, read-only original roster and the change history below it. Changing the original is rejected by PostgreSQL, including writes through other application paths. Archived and older historical versions remain protected.

The migration backfills the original from the earliest retained published version and preserves all pre-existing versions, live slot IDs, open drafts, requests and audit payloads. Consequently, older schedules can retain more than two historical rows; no legacy data is purged. A pre-existing correction draft may still be finished once, while subsequent edits use the current roster.

Apply the migration through the approved deployment workflow before running the new application code. Worktree verification uses only its own isolated PostgreSQL cluster; production is not modified by development setup.
