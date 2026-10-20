# Published schedule cache

The manager and employee schedule screens share a Next.js Data Cache entry for
published slots. The key includes facility, schedule, version ID and revision.
The query also restricts slots to that facility/schedule and a published version.
Entries revalidate after one hour as a fallback and never contain session data.

Current/upcoming schedule selection is read from the database on every request.
Publication, direct edits and approved transfers produce a new published version,
so the next request uses a new key immediately. Date boundaries, archival and
deletion are handled by the uncached schedule selection. No tag invalidation is
needed for immutable published slots.

Employee names, roles, active status and picker options are read fresh for every
request. Inactive assignees retain their assignments and current names, but are
excluded from picker options. Capacity comes from the selected published version's
snapshot. Draft reads and transactional save/publication validation are unchanged.

The manager page prefetches and hydrates the same React Query key its client view
uses, matching the employee page. Existing browser cache/invalidation rules still
apply: the server cache does not push updates into already-open browser views.

This app does not enable Cache Components. The implementation uses the documented
`unstable_cache` API for that configuration; migrating to `use cache` requires a
separate review of the app-wide Cache Components change.
