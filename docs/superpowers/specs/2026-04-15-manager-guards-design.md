# Manager Guards Page — Design Spec
_Date: 2026-04-15_

## Overview

Replace the placeholder `(manager)/manager/guards` page with a full guards management interface. A manager can view, add, edit, and delete the guards assigned to their court. This spec also introduces a `GuardRank` enum that affects both guard profiles and the shibutz grid's `GuardPicker` filter.

---

## Scope

1. **Schema:** Add `GuardRank` enum + `guardRank` field on `User`
2. **Guards management page:** Table, add/edit modal, delete with confirmation
3. **Shibutz GuardPicker filter:** Restrict eligible guards by rank per row

---

## 1. Schema Change

Add to `prisma/schema.prisma`:

```prisma
enum GuardRank {
  GUARD          // מאבטח — can only fill מאבטח (פתיחה) rows
  BAKAR          // בקר   — can fill בקר, בע״ת, and פתיחה rows
  SHIFT_MANAGER  // אחמ״ש — can fill any row
}
```

Add field to `User` model:

```prisma
model User {
  ...
  guardRank GuardRank?   // null for MANAGER and ADMIN
}
```

Migration name: `add_guard_rank`

**Data backfill:** The migration SQL must include:
```sql
UPDATE "User" SET "guardRank" = 'GUARD' WHERE role = 'GUARD';
```
This ensures existing guards default to `GUARD` rank and remain visible in the shibutz picker. Managers can upgrade their rank afterward.

**Seed update:** Add `guardRank` to all guard entries in `prisma/seed.ts`. Default to `GUARD` unless otherwise specified.

**GuardPicker null handling:** Guards with `guardRank = null` are excluded from the picker. After the backfill migration this should not happen in practice, but is a safe default.

---

## 2. Guards Management Page

### Architecture

- **Pattern:** Server component fetches data → client component owns UI state → server actions for mutations → `router.refresh()` after each mutation.
- **Scope enforcement:** All server actions call `requireSession(Role.MANAGER)` and derive `courtId` from `session.user.primaryCourtId`. `updateGuard` and `deleteGuard` verify the target guard's `primaryCourtId === manager's courtId` before any DB write.

### Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/app/(manager)/manager/guards/page.tsx` | Server component — fetch guards, render `GuardsTable` |
| Create | `src/app/(manager)/manager/guards/actions.ts` | Server actions: `createGuard`, `updateGuard`, `deleteGuard` |
| Create | `src/components/guards/guards-table.tsx` | Client component — table + add button, wires modal |
| Create | `src/components/guards/guard-modal.tsx` | Client component — add/edit modal dialog |

### Data Fetching (`page.tsx`)

```ts
const session = await requireSession(Role.MANAGER)
const courtId = session.user.primaryCourtId ?? ''

const guards = await prisma.user.findMany({
  where: { role: 'GUARD', primaryCourtId: courtId },
  select: { id, name, email, phone, isActive, guardRank },
  orderBy: { name: 'asc' },
})
```

Both active and inactive guards are returned. The table shows inactive rows dimmed (`opacity-50`).

### Table Columns

`#` | שם | דרגה | אימייל | טלפון | סטטוס | ✏️ 🗑️

- **דרגה** badge: "אחמ״ש" (dark), "בקר" (blue), "מאבטח" (grey)
- **סטטוס** badge: "פעיל" (green), "לא פעיל" (grey)
- **Add button** top-right: `+ הוסף מאבטח`
- Inactive rows: `opacity-50`

### Add/Edit Modal

**Create** (title: "הוספת מאבטח"):

| Field | Required | Validation |
|-------|----------|------------|
| שם מלא | ✓ | Non-empty |
| דרגה | ✓ | Dropdown: מאבטח / בקר / אחמ״ש |
| אימייל | ✓ | Valid email, unique in DB |
| טלפון | — | Optional |
| סיסמה זמנית | ✓ | Min 6 characters |

New guard is created with `role: GUARD`, `isActive: true`, `primaryCourtId` = manager's `courtId`. Password is hashed with bcrypt before saving.

**Edit** (title: "עריכת מאבטח"):

| Field | Required | Notes |
|-------|----------|-------|
| שם מלא | ✓ | |
| דרגה | ✓ | Dropdown |
| אימייל | ✓ | Unique check excludes self |
| טלפון | — | |
| סיסמה חדשה | — | Leave blank to keep; min 6 if provided |
| פעיל | — | Toggle checkbox |

**Error handling:** Server action returns `{ error: string }` on failure (e.g., duplicate email). Modal stays open, error displayed inline. On success, modal closes and `router.refresh()` is called.

### Server Actions (`actions.ts`)

```ts
createGuard(data: { name, guardRank, email, phone?, password, courtId })
  → { ok: true } | { error: string }

updateGuard(data: { id, name, guardRank, email, phone?, newPassword?, isActive })
  → { ok: true } | { error: string }

deleteGuard(data: { id, force?: boolean })
  → { ok: true } | { needsConfirm: true; assignmentCount: number } | { error: string }
```

**Delete flow:**
1. Verify guard belongs to manager's court.
2. Count `ShiftAssignment` records for this guard.
3. If count > 0 and `force !== true` → return `{ needsConfirm: true, assignmentCount: N }`.
4. Client shows: *"למאבטח יש N שיבוצים. מחיקה תסיר אותם לצמיתות. להמשיך?"*
5. If confirmed, client calls `deleteGuard({ id, force: true })`.
6. Action deletes assignments then user in a Prisma transaction.

---

## 3. Shibutz GuardPicker Filter

### Rank Eligibility Map

| Row label | Eligible ranks |
|-----------|---------------|
| אתמ״ש | `SHIFT_MANAGER` |
| בקר | `BAKAR`, `SHIFT_MANAGER` |
| בע״ת | `BAKAR`, `SHIFT_MANAGER` |
| פתיחה | `GUARD`, `BAKAR`, `SHIFT_MANAGER` |

### Row label → rank mapping logic

The row label is determined by `getRowLabel(shiftType, slotIndex)` in `utils.ts`. Add a companion helper:

```ts
// src/components/shibutz/utils.ts
export function getEligibleRanks(shiftType: ShiftType, slotIndex: number): GuardRank[] {
  const label = getRowLabel(shiftType, slotIndex)
  switch (label) {
    case 'אתמ״ש': return [GuardRank.SHIFT_MANAGER]
    case 'בקר':   return [GuardRank.BAKAR, GuardRank.SHIFT_MANAGER]
    case 'בע״ת':  return [GuardRank.BAKAR, GuardRank.SHIFT_MANAGER]
    default:       return [GuardRank.GUARD, GuardRank.BAKAR, GuardRank.SHIFT_MANAGER]
  }
}
```

### Changes to shibutz components

**`types.ts`:** Add `guardRank: GuardRank | null` to `GuardSummary`.

**`page.tsx`:** Include `guardRank` in the guards select query.

**`assignment-cell.tsx`:** Accept `slotIndex` and `shiftType` props (already has `shiftType`; add `slotIndex`). Pass both down to `GuardPicker`.

**`guard-picker.tsx`:** Accept `eligibleRanks: GuardRank[]` prop. Filter the guards list before rendering:
```ts
const eligible = guards.filter(g => g.guardRank && eligibleRanks.includes(g.guardRank))
```

**`shift-section.tsx`:** Pass `slotIndex` (row index) to each `AssignmentCell`.

---

## 4. Tests

- Unit tests for `getEligibleRanks` (all row label cases) in `tests/shibutz-utils.test.ts`
- No additional integration tests needed — server actions follow the same pattern as shibutz actions which are already tested via manual dev verification.
