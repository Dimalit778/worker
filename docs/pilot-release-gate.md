# Pilot release gate

This gate tracks section 4 of the technical launch work. Passing a build alone does not approve a pilot.

## Delivery order

1. Reliability and access: transaction-level active-manager checks; atomic invitation/password-reset redemption; serialized link replacement; reject login if the password or active status changes during verification; collect tests only from the root `tests` and `src` trees.
2. Submissions and publication: availability draft saving, stale-save protection, submission deadline races, weekly periods and Jerusalem daylight-saving boundaries. Verify existing version migration preserves submissions and history, and published schedules remain visible during corrections.
3. Notifications: leave and swap requests (`EmployeeRequest`) already exist, so what remains is verifying their server authorization and approval workflows, plus notification records and a durable delivery queue with retries and deduplication. Obtain explicit schema/migration approval before editing those files.
4. Screen polish and full workflow: Hebrew error screens, invitation → login → submission → assignment → publication → correction → swap → received update.

Keep each delivery in its own branch/PR. Wait for human confirmation and synchronize the default branch after merge before starting the next delivery. This repository currently uses `master` as its default branch.

## Existing infrastructure to verify

- `ScheduleVersion`, draft/published pointers and version-bound slots already exist. PostgreSQL tests cover migration preservation, concurrent edits/publications, immutable published snapshots and facility isolation.
- Active employees, invitation/reset links and current-user permission checks already exist; the current branch strengthens race handling.
- CI provisions PostgreSQL 16 (`worker_test`), applies repository migrations and runs all tests. PostgreSQL suites are skipped without `TEST_DATABASE_URL`; skipped suites are not evidence of a pass.
- Worktree preparation creates private environment configuration. The launcher requires explicit human approval bound to the schema fingerprint before migrating its isolated database.

## Required evidence before pilot

- [ ] All unit and PostgreSQL integration suites pass in CI.
- [ ] End-to-end workflow passes, including receipt of the update after a swap.
- [ ] Two simultaneous edits cannot silently overwrite one another.
- [ ] A save crossing the submission deadline is rejected without partial writes.
- [ ] Inactive users cannot sign in, submit, edit or receive new assignments.
- [ ] Weekly periods and both Jerusalem daylight-saving transitions pass.
- [ ] Failed message delivery is retried without losing or duplicating notifications.
- [ ] Production build passes.
- [ ] Isolated development environment starts and login URL is verified.
- [ ] Error monitoring and scheduled-job failure alerts are configured and tested.
- [ ] A backup has been restored into a separate database and its contents checked.
- [ ] Hebrew error screens cover application errors, missing pages and failed server actions.

Operational checks must record actual evidence, owner and date before checking a box. Do not use production data for worktree demo/test setup.
