# Capacity Rules Settings Page — Design Spec

**Date:** 2026-04-18  
**Status:** Approved

## Problem

Each court has different shift staffing requirements. The current codebase hardcodes a single global `DEFAULT_CAPACITY` constant (`MORNING: 15, EVENING: 6, NIGHT: 3`) in `src/features/shibutz/queries.ts`. While the database schema already supports per-court `ShiftCapacityRule` rows, there is no UI for managers to view or edit them.

## Goal

Allow a manager to set the maximum staff count for each shift type (MORNING, EVENING, NIGHT) for their own court only, via a dedicated settings page. Changes take effect immediately in the shibutz grid.

## Scope

- **In scope:** Simple rules — one max-staff value per shift type, applying to all days of the week (`dayOfWeek: null`).
- **Out of scope:** Per-day-of-week rules, min-staff configuration, district-level overrides.

## Architecture

### 1. Server Action — `upsertCapacityRules`

**File:** `src/features/shibutz/actions.ts`

```ts
type CapacityRulesInput = { MORNING: number; EVENING: number; NIGHT: number };
export async function upsertCapacityRules(rules: CapacityRulesInput): Promise<{ ok: true } | { error: string }>
```

- Calls `requireSession(SystemRole.MANAGER)`.
- Reads `courtId` from `session.user.primaryCourtId` — never from the client.
- Returns `{ error: '...' }` if the manager has no court.
- Upserts three `ShiftCapacityRule` rows using `prisma.shiftCapacityRule.upsert` with `where: { courtId_shiftType_dayOfWeek: { courtId, shiftType, dayOfWeek: null } }`.
- Sets `minStaff: 0` (unchanged/default) and `maxStaff` from input.
- Calls `revalidatePath('/manager/settings')` and `revalidatePath('/manager/shibutz')`.

### 2. Query — `getCapacityRules`

**File:** `src/features/shibutz/queries.ts`

```ts
export async function getCapacityRules(courtId: string): Promise<CapacityMap>
```

- Fetches `ShiftCapacityRule` rows for `courtId` where `dayOfWeek IS NULL`.
- Merges with `DEFAULT_CAPACITY` so missing rules fall back to defaults.
- Returns a `CapacityMap` (`{ MORNING, EVENING, NIGHT }`).

### 3. Form Component — `CapacityRulesForm`

**File:** `src/features/shibutz/components/capacity-rules-form.tsx`

- `'use client'` component.
- Props: `initialValues: CapacityMap`.
- Three labeled number inputs (min=1) for MORNING / EVENING / NIGHT.
- On submit: calls `upsertCapacityRules`, shows success or error state inline (no external toast library needed — a simple `<p>` state message).
- Disables submit button while pending (uses `useTransition`).

### 4. Settings Page

**File:** `src/app/(manager)/manager/settings/page.tsx`

- Server component.
- `requireSession(SystemRole.MANAGER)` → reads `courtId`.
- Calls `getCapacityRules(courtId)`.
- Renders heading + `CapacityRulesForm` with fetched values.

### 5. Nav Link

**File:** `src/app/(manager)/layout.tsx`

- Add `{ href: '/manager/settings', label: 'הגדרות' }` to `navItems`.

## Data Flow

```
Page load
  → requireSession → courtId
  → getCapacityRules(courtId) → CapacityMap (with DEFAULT_CAPACITY fallback)
  → CapacityRulesForm rendered with initial values

Form submit
  → upsertCapacityRules({ MORNING, EVENING, NIGHT })
  → server: requireSession → courtId (from session, not client)
  → prisma.upsert × 3 (one per ShiftType, dayOfWeek: null)
  → revalidatePath('/manager/settings')
  → revalidatePath('/manager/shibutz')
  → shibutz grid now reflects new capacity
```

## Security

- `courtId` is sourced exclusively from `session.user.primaryCourtId` in the server action.
- No client-supplied court identifier is accepted.
- A manager with no assigned court receives an error response and cannot write rules.
- `requireSession(SystemRole.MANAGER)` blocks non-managers at the action level.

## Files Changed

| File | Change |
|------|--------|
| `src/features/shibutz/actions.ts` | Add `upsertCapacityRules` |
| `src/features/shibutz/queries.ts` | Add `getCapacityRules` |
| `src/features/shibutz/components/capacity-rules-form.tsx` | New component |
| `src/app/(manager)/manager/settings/page.tsx` | New page |
| `src/app/(manager)/layout.tsx` | Add nav link |
