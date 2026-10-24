# Data caching

The application uses the Next.js Data Cache (`unstable_cache`, without enabling
Cache Components; migrating to `use cache` needs a separate review of the
app-wide change). Authentication and current user permission checks run outside
cached loaders. Facility ID is part of both the cache key and its invalidation
tag. Cached results contain display DTOs, not Prisma clients or transaction input,
and never session data.

| View | Cached data | Fallback revalidation |
| --- | --- | --- |
| Published roster | Immutable slots, keyed by facility/schedule/version/revision; the query also restricts slots to that facility/schedule and a published version | 1 hour |
| Draft roster | Display assignments, warnings, fairness and submission summary, keyed by facility/schedule/version/revision/display status | 30 seconds |
| Manager dashboard | Counts, submission summary, yearly schedules and display warnings | 30 seconds; a fresh clock bucket forces a miss at the next window |
| Settings | Positions, capacities, submission-window rule and dated overrides | 5 minutes; overrides also include the Jerusalem calendar date in their key |
| Admin screens | Shared districts/facilities/employee aggregate, after the admin permission check | 5 minutes |
| Schedule list/change log | Facility-scoped display data; each schedule's change log is keyed by facility/schedule | 30 seconds |

## Published roster

Manager and employee schedule screens share one cache entry for published slots.
Current/upcoming schedule selection is read from the database on every request.
Publication, direct edits and approved transfers produce a new revision, so the
next request uses a new key immediately; no tag invalidation is needed for the
immutable published slots. Employee names, roles, active status and picker
options are read fresh on every request. Inactive assignees keep their
assignments and current names but are excluded from picker options. Capacity
comes from the selected published version's snapshot. The manager page
prefetches and hydrates the same React Query key its client view uses.

## Committed writes and dependencies

- `scheduleTransaction` immediately expires facility data after commit. This
  covers editing, generation, publication, transfers, approved absences, staffing
  requirements/overrides, schedule creation/archival and deadline extensions.
- Successful availability saves/submissions/discards expire facility data after
  their own transaction commits. Cancelling an approved absence also expires it.
- Manager employee create/update/activation changes expire facility data and the
  shared admin aggregate. Admin mutations expire all facility data and admin data.
- Position color changes expire all facilities because positions can be global.
  Saving a submission-window rule expires the owning facility.
- Failed transactions do not expire caches. Save/generation/publication validity
  checks continue to load live data inside their transaction; they never use the
  draft display cache.

Invalidation uses `revalidateTag(tag, { expire: 0 })`, so the next request waits
for fresh data. The TTL is a fallback, not the mechanism for seeing committed
application writes. Invalidation is intentionally broad within a facility to
cover dependencies such as adjacent schedules and availability without relying
on a roster revision alone. Raw database changes outside these application write
paths receive only fallback revalidation.

## Browser behavior

Employee read-only rosters, availability and the dashboard refresh every 30
seconds while visible. Stale queries refresh when the window regains focus.
Editable manager rosters keep focus/timer refresh disabled to retain the revision
against which pending changes were staged; saves still refresh/patch their data.
Employee, settings and availability mutations also invalidate dependent browser
queries. Cross-browser updates use subsequent reads/periodic refresh, not push.

## Serialization and tests

Cache misses and hits return equivalent display DTOs. Published slot dates are
stored as ISO strings, and change-history dates are explicitly restored to Date
objects at the query boundary. Unit tests model the JSON cache boundary and
exercise cache keys, facility isolation, authorization on hits, committed-write
invalidation, clock boundaries and history serialization. Standard PostgreSQL
suites require a separate localhost `_test` database; they are skipped without it.
