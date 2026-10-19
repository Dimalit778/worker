# Scheduling architecture

The application remains a Next.js modular monolith using Prisma/PostgreSQL and a pure TypeScript scheduler. Route actions authenticate current database identities. Facility membership is `UserFacilityRole` (`userId`, `facilityId`, `FacilityRole`). A manager is `SystemRole.USER` plus `FacilityRole.MANAGER`. `SystemRole` is only `USER` or `ADMIN`. The session portal is derived from that: admin, otherwise manager, otherwise employee.

## Model names

`District` replaced `Region`, `Facility` replaced `Court`, and foreign keys are `districtId` and `facilityId`. `ShiftRole` replaced `Position` (`primaryShiftRoleId` on employees, `shiftRoleId` on staffing and assignments). `StaffingRequirement` replaced `ShiftCapacity`. Availability is `AvailabilitySubmission` plus `ShiftAvailability`. Published state lives on `RosterVersion` (`DRAFT` | `PUBLISHED` | `ARCHIVED`, `isActive`, `publishedAt`). `Roster` has `archivedAt` and no status column. `SchedulePeriod.submissionState` is `SCHEDULED` | `OPEN` | `CLOSED`. Fairness rows are `EmployeeScheduleStats`. Settings are `SystemSetting`.

## Invariants

Automatic generation follows the [minimum-first scheduling priorities](scheduling-priorities.md): weekly minimums across the whole period precede extras, and extras are balanced by shift type before historical workload and preferences break ties.

- `Employee.capability` and `Position.requiredCapability` use GUARD < CONTROLLER < SHIFT_MANAGER. Display labels do not grant qualification. The employee's existing position remains a personnel designation; it is not a management permission.
- `SchedulePeriod.submissionState` controls submissions. Every save checks opening and deadline timestamps regardless of cron or the legacy `Roster.status` display projection. Only submitted forms participate. Missing/UNAVAILABLE slots block assignment; PREFERRED is a soft preference. Empty availability is a valid submission.
- One DRAFT version and one active PUBLISHED version per schedule are enforced by partial unique indexes. `isActive` means the current publication, not that today's date is within its period.
- A published roster is read-only. Open a correction from the current/upcoming roster. Its assignments are copied to a draft; employees continue to see the old version until publication. Publication requires a reason and confirms any staffing/minimum/fairness warnings. Hard validation failures cannot be confirmed away.
- Every mutation receives `{ versionId, revision }`. Facility row locking, serializable transactions and an in-transaction membership check coordinate writes, validation, analysis and audit. Stale/conflicting operations require a refresh; they are not blindly retried.
- Shared validation covers active employees, capability, availability, court/date/role requirements, capacity and rest, including other current publications adjacent to the period. Deletion/unlocking can repair an invalid draft; a final full validation is mandatory at publication.
- Provenance (`MANUAL`/`AUTOMATIC`) is separate from `isLocked`. Regeneration replaces **all unlocked assignments**, including manual edits. Use the lock control to preserve an assignment. The UI confirms this before regeneration.
- Fairness uses the current published version of each schedule in the preceding 56 days plus the working draft. Nights/weekends, total workload, preference, then stable employee ID determine ordering. Historical assignments are not included in draft totals or returned generated assignments. The draft screen shows workload measures separately.
- Warnings and fairness records are derived per-version caches. Assignment content is protected after publication; version metadata permits only deactivation of a former publication. Audit payloads are append-only. Parent deletion cannot remove published history. The existing delete operation archives schedules with history.

## Deployment

1. Back up any data that must be kept. This migration maps the original fixture role codes to capabilities once and backfills manager court memberships from their employee records. Verify that mapping if adapting the migration to real data. It normalizes duplicate draft/current version flags and clears old analysis caches whose version cannot be known.
2. Run `pnpm db:generate`, then `pnpm db:deploy` against the intended database. The migration includes handwritten partial indexes and triggers; `db push` alone does **not** install the invariants.
3. Run `pnpm db:check-rls` using the deployment connection. The old RLS policies are retained but are **not** relied on: the application does not set their transaction context. Owner/superuser/BYPASSRLS connections can bypass enabled policies. A restricted non-owner deployment requires a separately tested context-and-policy implementation before switching the runtime role. Do not expose this database directly to clients.
4. Check one manager login, employee submission, draft generation, lock/regeneration, initial publish and correction publish. Refresh any sessions after role provisioning changes to update navigation hints; server checks already read the current role.

The main seed now requires an empty development database instead of deleting history. `seed-employees.ts` populates explicit capabilities and manager memberships. Historical demo scripts refuse to overwrite existing periods. Do not run old demos against a live database.

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm test:run`, `pnpm build`.
- PostgreSQL integration: create an empty **local test database**, run all migrations with DATABASE_URL pointing to it, then run `TEST_DATABASE_URL=postgresql://.../worker_architecture_test pnpm test:integration`.
- Integration tests create isolated fixture courts and retain their histories. They never reset the application database; use a disposable test database. Without TEST_DATABASE_URL they are explicitly skipped.
- Database tests cover authorization revocation/isolation, explicit submission ownership and deadline, unsubmitted/unavailable slots, capability, old-version retention, immutable metadata, moving rows into publications, concurrent edits/publication, regeneration locks, adjacent-period rest and no duplicate historical fairness.

No migration has been applied automatically to the application's configured database. The attempted configured-connection RLS inspection failed; its runtime role/policies remain unverified. Local database test results are not a production RLS verification.
