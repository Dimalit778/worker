# Design: Employee Warnings & Availability — Future Schedule Page

**Date:** 2026-05-18  
**Status:** Approved

---

## Context

The `future-schedule` manager page currently shows:
- A flat warnings panel grouped by severity (ERROR / WARNING / INFO) — hard to tell which employee has which issues
- An availability summary that shows only who submitted vs. who didn't — no per-employee status at a glance

Managers need a faster way to understand: which employees have issues, what those issues are, and whether they submitted availability — without extra navigation.

---

## What We're Building

Replace the two separate sections (availability card + warnings panel) with a unified, compact layout inside the existing header card:

### 1. Three stat cards (inside the header card's `CardContent`)

| Card | Content | Interaction |
|------|---------|-------------|
| הגשות זמינות | `submitted / eligible` count + progress bar | Static (no click) |
| שגיאות קריטיות | Error count (red) | Click → toggle employee-grouped error panel |
| אזהרות | Warning + info count (amber) | Click → toggle employee-grouped warnings panel |

- Cards are responsive: 3 columns on desktop, 2 columns on mobile (submissions card spans full width on mobile)
- Active stat card gets a colored ring to indicate open state

### 2. Collapsible employee-grouped panel (between header card and schedule grid)

- Hidden by default; appears when a stat card is clicked
- Clicking the same card again closes it; clicking the other swaps the content
- Content is grouped by employee, each group styled by their worst severity:
  - Error employees → red group card
  - Warning/info employees → amber/blue group card
- Each group shows: employee name · position | severity tag | bullet list of their warning messages with date + shift context
- Animated slide-in (`slideDown` keyframe)

### 3. Removed

- The old `WarningsPanel` component (flat severity list) is replaced
- The standalone availability "missing employees" card is replaced by the new stat cards row

---

## Responsive Behavior

- **≥ 640px**: 3-column stats grid, full-width panel card below
- **< 520px**: stats grid becomes 2-column, submissions card spans both columns; employee rows wrap tags to next line

---

## Data

No new data fetching required. All data already exists in `FutureScheduleData`:
- `warnings: ScheduleWarningSummary[]` — group by `employeeName`, label by `severity`
- `availabilitySubmissionSummary` — provides `submittedCount`, `eligibleEmployeeCount`

The warnings panel needs warnings grouped by employee client-side (same approach as current severity grouping in `WarningsPanel`).

---

## Files to Change

| File | Change |
|------|--------|
| `src/app/(manager)/manager/future-schedule/page.tsx` | Replace availability cards + `<WarningsPanel>` with new `<ScheduleSummaryBar>` + `<EmployeeWarningsPanel>` |
| `src/features/schedules/components/warnings-panel.tsx` | Replace entirely with new `EmployeeWarningsPanel` component |
| `src/features/schedules/types.ts` | No change needed |

New component names:
- `ScheduleSummaryBar` — the 3 stat cards row (client component, handles click state)
- `EmployeeWarningsPanel` — the collapsible grouped-by-employee detail panel (can be part of same file)

---

## Non-Goals

- No per-employee availability slot detail (which specific shifts they marked available) — out of scope
- No changes to the schedule grid component
- No new database queries
