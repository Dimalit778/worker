# Data caching

The application uses the Next.js Data Cache (`unstable_cache`, without enabling
Cache Components). Authentication and current user permission checks run outside
cached loaders. Facility ID is part of both the cache key and its invalidation
tag. Cached results contain display DTOs, not Prisma clients or transaction input.

| View | Cached data | Fallback revalidation |
| --- | --- | --- |
| Published roster | Immutable slots, keyed by facility/schedule/version/revision | 1 hour |
| Draft roster | Display assignments, warnings, fairness and submission summary, keyed by facility/schedule/version/revision/display status | 30 seconds |
| Manager dashboard | Counts, submission summary, yearly schedules and display warnings | 30 seconds; a fresh clock bucket forces a miss at the next window |
| Settings | Positions, capacities, submission-window rule and dated overrides | 5 minutes; overrides also include the Jerusalem calendar date in their key |
| Admin screens | Shared districts/facilities/employee aggregate, after the admin permission check | 5 minutes |
| Schedule list/change history | Facility-scoped display data; change history loads related entries together | 30 seconds |

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

## Local runtime verification

Authenticated requests to Next.js on the isolated worktree database exercised
cold reads, cache hits and immediate tag expiration. The temporary verification
route was removed before commit. These are Prisma data-read call counts (not SQL
statement counts), excluding authentication and shared layout work:

| Data path | Cold | Cache hit | After tag expiration |
| --- | ---: | ---: | ---: |
| Settings | 4 | 0 | 4 |
| Draft display loader | 8 | 1 (live schedule/version selection) | 8 |
| Dashboard | 6 | 0 | 6 |
| Schedule list | 1 | 0 | 1 |
| Grouped change history | 1 | 0 | 1 |

The fixture used an existing published schedule through the draft loader's
published-version fallback. Actual draft analysis and invalidation are also
covered by unit tests. These local fixture results are not a production benchmark.

## Files changed in this extension

- `docs/data-caching.md`
- `src/features/admin/actions.ts`
- `src/features/availability/actions.ts`
- `src/features/availability/hooks.ts`
- `src/features/dashboard/hooks.ts`
- `src/features/dashboard/queries.ts`
- `src/features/employess/actions.ts`
- `src/features/employess/hooks.ts`
- `src/features/requests/actions.ts`
- `src/features/schedules/assignments/queries.ts`
- `src/features/schedules/change-log/queries.ts`
- `src/features/schedules/hooks.ts`
- `src/features/schedules/schedulecard/queries.ts`
- `src/features/schedules/services/transactions.ts`
- `src/features/settings/actions.ts`
- `src/features/settings/hooks.ts`
- `src/features/settings/queries.ts`
- `src/lib/cache/data-cache.ts`
- `src/lib/react-query/get-query-client.ts`
- `tests/cache-write-boundaries.test.ts`
- `tests/cached-screen-queries.test.ts`
- `tests/data-cache.test.ts`
- `tests/helpers/cache-runtime.ts`
- `vitest.setup.ts`
