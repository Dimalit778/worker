# Shibutz Grid — Design Spec
_Date: 2026-04-14_

## Overview

Replace the current placeholder `(manager)/manager/shibutz` page with a full interactive schedule grid that lets a manager view and edit guard assignments for the active 14-day scheduling period.

---

## Layout

- **Single-week view** with `‹ ›` navigation to switch between the two 7-day halves of the period.
- **RTL** throughout. Columns run right→left: א (Sunday) on the right, ש (Saturday) on the left.
- **Three shift sections** stacked vertically: בוקר (MORNING), ערב (EVENING), לילה (NIGHT), each with its own coloured header.
- **Week indicator**: two dots below the week label — filled dot = current week.

### Column headers (per section)

```
# | משמרת | א(22/3) | ב(23/3) | ג(24/3) | ד(25/3) | ה(26/3) | ו(27/3) | ש(28/3)
```

Dates are displayed as DD/MM. Day letter (א–ש) on top, date below in muted text.

### Row labels

| Shift    | Row 1  | Row 2 | Row 3  | Rows 4–N       |
|----------|--------|-------|--------|----------------|
| בוקר     | אתמ״ש | בקר   | בע״ת   | פתיחה (slots)  |
| ערב      | אתמ״ש | בקר   | —      | פתיחה (slots)  |
| לילה     | בע״ת  | —     | —      | פתיחה (slots)  |

- Row 1 of MORNING = `isOpeningDuty = true` assignment.
- All other rows = regular assignments ordered by creation time.
- Max slots per shift come from `ShiftCapacityRule.maxStaff` for the court + shift type. Default fallback: morning=15, evening=6, night=3.

### Cell states

| State   | Visual                        |
|---------|-------------------------------|
| Closed  | Solid black background (Friday night + all Saturday) |
| Empty   | Light grey background, clickable |
| Filled  | Guard name, clickable to change |

---

## Data Loading (Server Component)

`shibutz/page.tsx` fetches:

1. **Current scheduling period** — `getCurrentSchedulingPeriod()` (existing helper).
2. **Active schedule** — latest `Schedule` for that period (status `DRAFT` or `PUBLISHED`).
3. **Shift assignments** — all `ShiftAssignment` records for that schedule, with `user` name included.
4. **Active guards** — `User` where `role = GUARD` and `isActive = true`, for the assignment picker.
5. **Capacity rules** — `ShiftCapacityRule` for all courts, to determine max slots per section.

If no period exists → show "אין תקופת תזמון פעילה" empty state.  
If period exists but no schedule → show empty grid (all cells empty, still editable so manager can start filling).  
If no schedule exists yet, a new `Schedule` (DRAFT) is created on the first assignment action.

---

## Interactivity (Client)

### Week navigation

`weekIndex` state (0 = week 1, days 1–7; 1 = week 2, days 8–14). Navigation arrows update state; no server round-trip.

### Cell click → GuardPicker

Clicking any non-closed cell opens a **popover** (shadcn Popover + Command) with:
- Search input to filter guards by name.
- List of active guards.
- "הסר שיבוץ" (Remove) option if cell is currently filled.

Selecting a guard calls a **server action** and optimistically updates the cell.

### Server actions (`src/app/(manager)/manager/shibutz/actions.ts`)

```ts
assignGuard(scheduleId: string | null, periodId: string, userId: string,
            courtId: string, date: Date, shiftType: ShiftType,
            isOpeningDuty: boolean): Promise<{ scheduleId: string }>

removeAssignment(assignmentId: string): Promise<void>
```

`assignGuard` upserts on `(scheduleId, userId, date, shiftType)`. If `scheduleId` is null, it creates a DRAFT Schedule first, then assigns.

---

## Component Tree

```
shibutz/page.tsx  (Server Component — fetches all data)
└── ShibutzGrid   (Client Component — owns weekIndex state)
    ├── WeekNavigator
    ├── ShiftSection × 3  (MORNING / EVENING / NIGHT)
    │   └── AssignmentCell × (maxSlots × 7)
    │       └── GuardPicker (Popover + Command — rendered when cell is active)
    └── EmptyState (shown when no period)
```

Files:
- `src/app/(manager)/manager/shibutz/page.tsx` — updated server component
- `src/app/(manager)/manager/shibutz/actions.ts` — server actions
- `src/components/shibutz/shibutz-grid.tsx`
- `src/components/shibutz/week-navigator.tsx`
- `src/components/shibutz/shift-section.tsx`
- `src/components/shibutz/assignment-cell.tsx`
- `src/components/shibutz/guard-picker.tsx`
- `src/components/shibutz/types.ts` — shared types

---

## Closed-day Logic

A cell is "closed" (black) when:
- `shiftType === NIGHT` and `dayOfWeek === 5` (Friday — schema uses 0=Sunday…6=Saturday)
- Any shift and `dayOfWeek === 6` (Saturday)

This is a client-side display rule, not stored in DB.

---

## Out of Scope (V1)

- Schedule generation / auto-assign
- Availability overlay (showing who marked themselves available)
- Multi-court selector (use manager's `primaryCourtId`)
- Warnings display
- Publishing the schedule
