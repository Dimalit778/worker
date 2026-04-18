# Manager Guards Page — Design Spec v2
_Date: 2026-04-18_

> Supersedes `2026-04-15-manager-guards-design.md`, which was written against a stale schema where `User` held name/phone/role directly. The current schema separates auth (`User`) from profile (`Employee`).

---

## Overview

Replace the placeholder `(manager)/manager/guards` page with a full guards management interface. A manager can view, add, edit, and delete the employees assigned to their court. Creating a guard provisions both an `Employee` record and a linked `User` account with a default password and a forced password-change flag.

---

## Scope

1. **Schema:** Add `mustChangePassword` to `User`
2. **Guards management page:** Table, add/edit modal, delete with confirmation
3. **Middleware:** Redirect guards whose `mustChangePassword` is `true` to `/change-password`

> The `/change-password` page itself is out of scope — only the flag and redirect are added here.

---

## 1. Schema Change

Add to `User` model in `prisma/schema.prisma`:

```prisma
mustChangePassword Boolean @default(false)
```

Migration name: `add_must_change_password`

No backfill needed — existing users default to `false`.

---

## 2. Middleware Update

In `src/lib/middleware.ts`, after the existing role-based redirect logic, add:

- If `token.mustChangePassword === true` and the current path is **not** `/change-password` or `/api/auth/*`, redirect to `/change-password`.

The JWT callback in `src/lib/auth.ts` must include `mustChangePassword` in the token (read from DB on sign-in).

### Auth changes

In `src/lib/auth.ts`, `authorize()`:

```ts
const user = await prisma.user.findUnique({
  where: { email },
  include: { employee: true },
})
// ...
return {
  id: user.id,
  email: user.email,
  name,
  systemRole: user.systemRole,
  primaryCourtId,
  mustChangePassword: user.mustChangePassword,
}
```

Add `mustChangePassword: boolean` to `next-auth.d.ts` `User`, `JWT`, and `Session` interfaces.

JWT callback: persist `token.mustChangePassword = user.mustChangePassword` on sign-in.
Session callback: expose `session.user.mustChangePassword`.

---

## 3. Guards Management Page

### Architecture

- **Pattern:** Server component fetches data → client component owns UI state → server actions for mutations → `router.refresh()` after each mutation.
- **Scope enforcement:** All server actions call `requireSession(SystemRole.MANAGER)` and derive `courtId` from `session.user.primaryCourtId`. `updateGuard` and `deleteGuard` verify the target employee's `primaryCourtId === manager's courtId` before any DB write.

### Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/app/(manager)/manager/guards/page.tsx` | Server component — fetch employees, render `GuardsTable` |
| Create | `src/features/guards/actions.ts` | Server actions: `createGuard`, `updateGuard`, `deleteGuard` |
| Create | `src/features/guards/components/guards-table.tsx` | Client component — table + add button, wires modal |
| Create | `src/features/guards/components/guard-modal.tsx` | Client component — add/edit modal dialog |

### Data Fetching (`page.tsx`)

```ts
const session = await requireSession(SystemRole.MANAGER)
const courtId = session.user.primaryCourtId ?? ''

const employees = await prisma.employee.findMany({
  where: { primaryCourtId: courtId },
  include: { user: { select: { email: true, mustChangePassword: true } } },
  orderBy: { name: 'asc' },
})
```

Both active and inactive employees are returned. Inactive rows render at `opacity-50`.

### Table Columns

`#` | שם | תפקיד | אימייל | סטטוס | ✏️ 🗑️

- **תפקיד** badge:
  - `SHIFT_MANAGER` → "אחמ״ש" dark slate
  - `BAKAR` → "בקר" blue
  - `GUARD` → "מאבטח" grey
  - `FACILITY_OFFICER` → "קצין מתקן" orange
- **סטטוס** badge: "פעיל" (green) / "לא פעיל" (grey)
- **Add button** top-right: `+ הוסף מאבטח`
- Inactive rows: `opacity-50`

### Add Modal (title: "הוספת מאבטח")

| Field | Required | Notes |
|-------|----------|-------|
| שם מלא | ✓ | `Employee.name` |
| אימייל | ✓ | `User.email`, unique in DB |
| תפקיד | ✓ | Dropdown: מאבטח / בקר / אחמ״ש / קצין מתקן |

On submit:
1. Validate email uniqueness.
2. Hash `"123456"` with bcrypt (cost 12).
3. Create `Employee` with `name`, `position`, `primaryCourtId`, `isActive: true`.
4. Create `User` with `email`, `passwordHash`, `systemRole: EMPLOYEE`, `mustChangePassword: true`, `employeeId` pointing to the new employee.

### Edit Modal (title: "עריכת מאבטח")

| Field | Required | Notes |
|-------|----------|-------|
| שם מלא | ✓ | |
| אימייל | ✓ | Unique check excludes self |
| תפקיד | ✓ | Dropdown |
| פעיל | — | Checkbox toggle |

No password field — guards reset their own password via the forced-change flow.

**Error handling:** Server action returns `{ error: string }` on failure. Modal stays open, error shown inline. On success, modal closes and `router.refresh()` is called.

### Server Actions (`src/features/guards/actions.ts`)

```ts
createGuard(data: { name, email, position })
  → { ok: true } | { error: string }

updateGuard(data: { employeeId, name, email, position, isActive })
  → { ok: true } | { error: string }

deleteGuard(data: { employeeId, force?: boolean })
  → { ok: true } | { needsConfirm: true; assignmentCount: number } | { error: string }
```

**Delete flow:**
1. Verify employee belongs to manager's court.
2. Count `ShiftAssignment` records for this employee.
3. If count > 0 and `force !== true` → return `{ needsConfirm: true, assignmentCount: N }`.
4. Client shows: *"למאבטח יש N שיבוצים. מחיקה תסיר אותם לצמיתות. להמשיך?"*
5. If confirmed, client calls `deleteGuard({ employeeId, force: true })`.
6. Action deletes in a Prisma transaction: `ShiftAssignment` → `User` (if linked) → `Employee`.

---

## 4. Type: GuardRow

```ts
export type GuardRow = {
  id: string          // Employee.id
  name: string
  position: Position
  isActive: boolean
  email: string | null        // null if no linked User
  mustChangePassword: boolean // false if no linked User
}
```

---

## Out of Scope

- `/change-password` page (separate feature)
- GuardPicker rank filtering in shibutz (covered by original spec — can be done independently)
- Admin-level guard management
