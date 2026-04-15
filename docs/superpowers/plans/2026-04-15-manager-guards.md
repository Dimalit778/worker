# Manager Guards & Guard Rank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the manager guards management page (view/add/edit/delete guards scoped to the manager's court) and add a `GuardRank` field that filters the shibutz grid's GuardPicker by eligibility per row.

**Architecture:** Server component fetches guards → `GuardsTable` client component owns modal/delete UI state → server actions for mutations → `router.refresh()` after each change. GuardRank is a new Prisma enum with a data-backfill migration. Shibutz picker gains a `getEligibleRanks` pure helper and filters the guard list before rendering.

**Tech Stack:** Next.js App Router, React 19, Prisma, bcryptjs, Tailwind CSS v4, Lucide icons, Vitest.

**Spec reference:** `docs/superpowers/specs/2026-04-15-manager-guards-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add `GuardRank` enum + `guardRank` field on `User` |
| Modify | `prisma/seed.ts` | Add `guardRank` to all guard seed entries |
| Modify | `src/components/shibutz/utils.ts` | Add `getEligibleRanks(shiftType, slotIndex)` |
| Modify | `tests/shibutz-utils.test.ts` | Add tests for `getEligibleRanks` |
| Create | `src/app/(manager)/manager/guards/actions.ts` | Server actions: `createGuard`, `updateGuard`, `deleteGuard` |
| Create | `src/components/guards/guard-modal.tsx` | Add/edit modal dialog |
| Create | `src/components/guards/guards-table.tsx` | Table + inline actions + delete confirm |
| Modify | `src/app/(manager)/manager/guards/page.tsx` | Server component — fetch + render |
| Modify | `src/components/shibutz/types.ts` | Add `guardRank` to `GuardSummary` |
| Modify | `src/components/shibutz/assignment-cell.tsx` | Add `slotIndex` prop, pass `eligibleRanks` to picker |
| Modify | `src/components/shibutz/guard-picker.tsx` | Accept `eligibleRanks` prop, filter guard list |
| Modify | `src/components/shibutz/shift-section.tsx` | Pass `slotIndex` to `AssignmentCell` |
| Modify | `src/app/(manager)/manager/shibutz/page.tsx` | Include `guardRank` in guards select query |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the GuardRank enum and field**

In `prisma/schema.prisma`, add the enum after the existing enums block:

```prisma
enum GuardRank {
  GUARD          // מאבטח
  BAKAR          // בקר
  SHIFT_MANAGER  // אחמ״ש
}
```

Add the field to the `User` model (after `isActive`):

```prisma
model User {
  id             String     @id @default(cuid())
  email          String     @unique
  passwordHash   String
  name           String
  phone          String?
  role           Role       @default(GUARD)
  primaryCourtId String?
  isActive       Boolean    @default(true)
  guardRank      GuardRank?
  createdAt      DateTime   @default(now())
  // ... relations unchanged
}
```

- [ ] **Step 2: Create the migration file without applying it**

```bash
pnpm exec prisma migrate dev --name add_guard_rank --create-only
```

Expected output: `Prisma Migrate created the following migration(s):  migrations/YYYYMMDDHHMMSS_add_guard_rank/migration.sql`

- [ ] **Step 3: Append the backfill to the migration SQL**

Find the generated file at `prisma/migrations/*_add_guard_rank/migration.sql`. It will contain the DDL for the new column. Append this line at the end:

```sql
UPDATE "User" SET "guardRank" = 'GUARD' WHERE role = 'GUARD';
```

- [ ] **Step 4: Apply the migration**

```bash
pnpm exec prisma migrate dev
```

Expected output: `Applied 1 migration(s).` and `✔ Generated Prisma Client`

- [ ] **Step 5: Verify GuardRank is in the generated client**

```bash
grep -r "GuardRank" src/generated/prisma/enums.ts
```

Expected: a line containing `GuardRank`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add GuardRank enum and guardRank field with backfill migration"
```

---

## Task 2: Update Seed Data

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add GuardRank import and guardRank to all guard entries**

In `prisma/seed.ts`, update the import line:

```ts
import { GuardRank, PeriodStatus, PrismaClient, Role, ShiftType } from '../src/generated/prisma/client'
```

Update the `guardData` array to include `guardRank`:

```ts
const guardData = [
  { email: 'cohen@court.gov.il',   name: 'יובל כהן',   guardRank: GuardRank.SHIFT_MANAGER },
  { email: 'levi@court.gov.il',    name: 'מיכל לוי',   guardRank: GuardRank.BAKAR },
  { email: 'abed@court.gov.il',    name: 'ראמי עבד',   guardRank: GuardRank.BAKAR },
  { email: 'shamir@court.gov.il',  name: 'עמית שמיר',  guardRank: GuardRank.GUARD },
  { email: 'nagar@court.gov.il',   name: 'דנה נגר',    guardRank: GuardRank.GUARD },
  { email: 'peretz@court.gov.il',  name: 'אלי פרץ',    guardRank: GuardRank.GUARD },
  { email: 'chaim@court.gov.il',   name: 'בן חיים',    guardRank: GuardRank.GUARD },
]
```

Update the `prisma.user.upsert` call inside the loop to include `guardRank` in both `update` and `create`:

```ts
for (const g of guardData) {
  const guard = await prisma.user.upsert({
    where: { email: g.email },
    update: { guardRank: g.guardRank },
    create: {
      email: g.email,
      passwordHash: guardHash,
      name: g.name,
      role: Role.GUARD,
      primaryCourtId: courtA.id,
      guardRank: g.guardRank,
    },
  })
  await prisma.courtEligibility.upsert({
    where: { userId_courtId: { userId: guard.id, courtId: courtA.id } },
    update: {},
    create: { userId: guard.id, courtId: courtA.id },
  })
}
```

- [ ] **Step 2: Run the seed to verify**

```bash
pnpm db:seed
```

Expected: `Seed complete.` with no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: add guardRank to seed guards"
```

---

## Task 3: getEligibleRanks Helper + Tests (TDD)

**Files:**
- Modify: `tests/shibutz-utils.test.ts`
- Modify: `src/components/shibutz/utils.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/shibutz-utils.test.ts`:

```ts
import { GuardRank } from '@/generated/prisma/client'
import { getEligibleRanks } from '@/components/shibutz/utils'

describe('getEligibleRanks', () => {
  it('אתמ״ש row (MORNING slot 0) allows only SHIFT_MANAGER', () => {
    expect(getEligibleRanks('MORNING', 0)).toEqual([GuardRank.SHIFT_MANAGER])
  })

  it('אתמ״ש row (EVENING slot 0) allows only SHIFT_MANAGER', () => {
    expect(getEligibleRanks('EVENING', 0)).toEqual([GuardRank.SHIFT_MANAGER])
  })

  it('בקר row (MORNING slot 1) allows BAKAR and SHIFT_MANAGER', () => {
    expect(getEligibleRanks('MORNING', 1)).toEqual([GuardRank.BAKAR, GuardRank.SHIFT_MANAGER])
  })

  it('בקר row (EVENING slot 1) allows BAKAR and SHIFT_MANAGER', () => {
    expect(getEligibleRanks('EVENING', 1)).toEqual([GuardRank.BAKAR, GuardRank.SHIFT_MANAGER])
  })

  it('בע״ת row (MORNING slot 2) allows BAKAR and SHIFT_MANAGER', () => {
    expect(getEligibleRanks('MORNING', 2)).toEqual([GuardRank.BAKAR, GuardRank.SHIFT_MANAGER])
  })

  it('בע״ת row (NIGHT slot 0) allows BAKAR and SHIFT_MANAGER', () => {
    expect(getEligibleRanks('NIGHT', 0)).toEqual([GuardRank.BAKAR, GuardRank.SHIFT_MANAGER])
  })

  it('פתיחה rows allow all ranks', () => {
    const all = [GuardRank.GUARD, GuardRank.BAKAR, GuardRank.SHIFT_MANAGER]
    expect(getEligibleRanks('MORNING', 3)).toEqual(all)
    expect(getEligibleRanks('EVENING', 2)).toEqual(all)
    expect(getEligibleRanks('NIGHT', 1)).toEqual(all)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
pnpm exec vitest run tests/shibutz-utils.test.ts
```

Expected: failures — `getEligibleRanks is not a function`

- [ ] **Step 3: Implement getEligibleRanks in utils.ts**

Replace the first line of `src/components/shibutz/utils.ts` to add the `GuardRank` value import:

```ts
import { GuardRank, type ShiftType } from '@/generated/prisma/client'
```

Then append at the end of `utils.ts`:

```ts
/**
 * Returns the guard ranks eligible to fill a given row.
 * Derived from the row's label: אתמ״ש → SHIFT_MANAGER only;
 * בקר / בע״ת → BAKAR or SHIFT_MANAGER; פתיחה → any rank.
 */
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

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm exec vitest run tests/shibutz-utils.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/shibutz/utils.ts tests/shibutz-utils.test.ts
git commit -m "feat(shibutz): add getEligibleRanks helper with tests"
```

---

## Task 4: Guards Server Actions

**Files:**
- Create: `src/app/(manager)/manager/guards/actions.ts`

- [ ] **Step 1: Create the actions file**

```ts
// src/app/(manager)/manager/guards/actions.ts
'use server'

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/client'
import { requireSession } from '@/lib/auth-helpers'
import { GuardRank, Role } from '@/generated/prisma/client'

type CreateGuardParams = {
  name: string
  email: string
  phone: string | null
  guardRank: GuardRank
  password: string
}

type UpdateGuardParams = {
  id: string
  name: string
  email: string
  phone: string | null
  guardRank: GuardRank
  newPassword?: string
  isActive: boolean
}

type DeleteGuardParams = {
  id: string
  force?: boolean
}

export async function createGuard(
  params: CreateGuardParams
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(Role.MANAGER)
  const courtId = session.user.primaryCourtId
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' }

  const { name, email, phone, guardRank, password } = params

  if (password.length < 6) return { error: 'הסיסמה חייבת להכיל לפחות 6 תווים' }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { error: 'אימייל כבר קיים במערכת' }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      guardRank,
      passwordHash,
      role: Role.GUARD,
      primaryCourtId: courtId,
      isActive: true,
    },
  })

  return { ok: true }
}

export async function updateGuard(
  params: UpdateGuardParams
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(Role.MANAGER)
  const courtId = session.user.primaryCourtId

  const { id, name, email, phone, guardRank, newPassword, isActive } = params

  const guard = await prisma.user.findFirst({
    where: { id, primaryCourtId: courtId ?? '' },
  })
  if (!guard) return { error: 'מאבטח לא נמצא' }

  if (newPassword && newPassword.length < 6) {
    return { error: 'הסיסמה חייבת להכיל לפחות 6 תווים' }
  }

  const duplicate = await prisma.user.findFirst({ where: { email, NOT: { id } } })
  if (duplicate) return { error: 'אימייל כבר קיים במערכת' }

  const data: Parameters<typeof prisma.user.update>[0]['data'] = {
    name,
    email,
    phone: phone || null,
    guardRank,
    isActive,
  }
  if (newPassword) data.passwordHash = await bcrypt.hash(newPassword, 12)

  await prisma.user.update({ where: { id }, data })

  return { ok: true }
}

export async function deleteGuard(params: DeleteGuardParams): Promise<
  { ok: true } | { needsConfirm: true; assignmentCount: number } | { error: string }
> {
  const session = await requireSession(Role.MANAGER)
  const courtId = session.user.primaryCourtId

  const { id, force } = params

  const guard = await prisma.user.findFirst({
    where: { id, primaryCourtId: courtId ?? '' },
  })
  if (!guard) return { error: 'מאבטח לא נמצא' }

  const assignmentCount = await prisma.shiftAssignment.count({ where: { userId: id } })

  if (assignmentCount > 0 && !force) {
    return { needsConfirm: true, assignmentCount }
  }

  await prisma.$transaction([
    prisma.shiftAssignment.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ])

  return { ok: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(manager\)/manager/guards/actions.ts
git commit -m "feat(guards): add createGuard, updateGuard, deleteGuard server actions"
```

---

## Task 5: GuardModal Component

**Files:**
- Create: `src/components/guards/guard-modal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
// src/components/guards/guard-modal.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { GuardRank } from '@/generated/prisma/client'
import { createGuard, updateGuard } from '@/app/(manager)/manager/guards/actions'
import type { GuardRow } from './guards-table'

const RANK_HE: Record<GuardRank, string> = {
  GUARD: 'מאבטח',
  BAKAR: 'בקר',
  SHIFT_MANAGER: 'אחמ״ש',
}

type Props = {
  guard: GuardRow | null  // null = create mode
  onClose: () => void
}

export function GuardModal({ guard, onClose }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isEdit = guard !== null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = fd.get('name') as string
    const email = fd.get('email') as string
    const phone = (fd.get('phone') as string) || null
    const guardRank = fd.get('guardRank') as GuardRank
    const password = fd.get('password') as string
    const isActive = fd.has('isActive')

    setError(null)
    startTransition(async () => {
      let result
      if (isEdit) {
        result = await updateGuard({
          id: guard.id,
          name,
          email,
          phone,
          guardRank,
          newPassword: password || undefined,
          isActive,
        })
      } else {
        result = await createGuard({ name, email, phone, guardRank, password })
      }

      if ('error' in result) {
        setError(result.error)
      } else {
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      dir="rtl"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">
            {isEdit ? 'עריכת מאבטח' : 'הוספת מאבטח'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">שם מלא *</label>
            <input
              name="name"
              defaultValue={guard?.name ?? ''}
              required
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Rank */}
          <div>
            <label className="block text-sm font-medium mb-1">דרגה *</label>
            <select
              name="guardRank"
              defaultValue={guard?.guardRank ?? GuardRank.GUARD}
              required
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              {(Object.keys(RANK_HE) as GuardRank[]).map(rank => (
                <option key={rank} value={rank}>{RANK_HE[rank]}</option>
              ))}
            </select>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">אימייל *</label>
            <input
              name="email"
              type="email"
              defaultValue={guard?.email ?? ''}
              required
              dir="ltr"
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-1">טלפון</label>
            <input
              name="phone"
              defaultValue={guard?.phone ?? ''}
              dir="ltr"
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1">
              {isEdit ? 'סיסמה חדשה (השאר ריק לשמור)' : 'סיסמה זמנית *'}
            </label>
            <input
              name="password"
              type="password"
              required={!isEdit}
              minLength={6}
              dir="ltr"
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Active toggle — edit only */}
          {isEdit && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                id="isActive"
                defaultChecked={guard.isActive}
                className="w-4 h-4"
              />
              <label htmlFor="isActive" className="text-sm font-medium">
                פעיל
              </label>
            </div>
          )}

          {/* Inline error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 bg-foreground text-background rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'שומר...' : 'שמור'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border rounded-md py-2 text-sm hover:bg-muted"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/guards/guard-modal.tsx
git commit -m "feat(guards): add GuardModal component"
```

---

## Task 6: GuardsTable Component

**Files:**
- Create: `src/components/guards/guards-table.tsx`

- [ ] **Step 1: Create the table component**

```tsx
// src/components/guards/guards-table.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GuardRank } from '@/generated/prisma/client'
import { deleteGuard } from '@/app/(manager)/manager/guards/actions'
import { GuardModal } from './guard-modal'

export type GuardRow = {
  id: string
  name: string
  email: string
  phone: string | null
  guardRank: GuardRank
  isActive: boolean
}

const RANK_HE: Record<GuardRank, string> = {
  GUARD: 'מאבטח',
  BAKAR: 'בקר',
  SHIFT_MANAGER: 'אחמ״ש',
}

const RANK_STYLE: Record<GuardRank, string> = {
  SHIFT_MANAGER: 'bg-slate-800 text-white',
  BAKAR: 'bg-blue-100 text-blue-800',
  GUARD: 'bg-slate-100 text-slate-600',
}

type DeleteTarget = {
  id: string
  name: string
  assignmentCount: number
}

export function GuardsTable({ guards }: { guards: GuardRow[] }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGuard, setEditingGuard] = useState<GuardRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deletePending, startDeleteTransition] = useTransition()

  function openAdd() {
    setEditingGuard(null)
    setModalOpen(true)
  }

  function openEdit(guard: GuardRow) {
    setEditingGuard(guard)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingGuard(null)
  }

  function handleDeleteClick(guard: GuardRow) {
    startDeleteTransition(async () => {
      const result = await deleteGuard({ id: guard.id })
      if ('needsConfirm' in result && result.needsConfirm) {
        setDeleteTarget({ id: guard.id, name: guard.name, assignmentCount: result.assignmentCount })
      } else if ('ok' in result) {
        router.refresh()
      }
      // 'error' case is silently ignored — only happens if guard not found, which can't occur from UI
    })
  }

  async function handleForceDelete() {
    if (!deleteTarget) return
    await deleteGuard({ id: deleteTarget.id, force: true })
    setDeleteTarget(null)
    router.refresh()
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">מאבטחים</h1>
        <button
          onClick={openAdd}
          className="bg-foreground text-background text-sm px-4 py-2 rounded-md hover:opacity-90"
        >
          + הוסף מאבטח
        </button>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 text-right">
              <th className="px-4 py-3 font-medium border-b border-border w-10">#</th>
              <th className="px-4 py-3 font-medium border-b border-border">שם</th>
              <th className="px-4 py-3 font-medium border-b border-border">דרגה</th>
              <th className="px-4 py-3 font-medium border-b border-border">אימייל</th>
              <th className="px-4 py-3 font-medium border-b border-border">טלפון</th>
              <th className="px-4 py-3 font-medium border-b border-border">סטטוס</th>
              <th className="px-4 py-3 border-b border-border w-16"></th>
            </tr>
          </thead>
          <tbody>
            {guards.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  אין מאבטחים. לחץ על &quot;+ הוסף מאבטח&quot; להוספה.
                </td>
              </tr>
            )}
            {guards.map((guard, i) => (
              <tr
                key={guard.id}
                className={cn(
                  'border-b border-border last:border-0 hover:bg-muted/20 transition-colors',
                  !guard.isActive && 'opacity-50'
                )}
              >
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{guard.name}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', RANK_STYLE[guard.guardRank])}>
                    {RANK_HE[guard.guardRank]}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground" dir="ltr">{guard.email}</td>
                <td className="px-4 py-3 text-muted-foreground" dir="ltr">{guard.phone ?? '—'}</td>
                <td className="px-4 py-3">
                  {guard.isActive
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">פעיל</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">לא פעיל</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => openEdit(guard)}
                      className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(guard)}
                      disabled={deletePending}
                      className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && <GuardModal guard={editingGuard} onClose={closeModal} />}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-bold text-lg">מחיקת מאבטח</h2>
            <p className="text-sm text-muted-foreground">
              למאבטח <span className="font-semibold text-foreground">{deleteTarget.name}</span> יש{' '}
              {deleteTarget.assignmentCount} שיבוצים. מחיקה תסיר אותם לצמיתות. להמשיך?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleForceDelete}
                className="flex-1 bg-destructive text-destructive-foreground rounded-md py-2 text-sm font-medium hover:opacity-90"
              >
                מחק
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-border rounded-md py-2 text-sm hover:bg-muted"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/guards/guards-table.tsx
git commit -m "feat(guards): add GuardsTable component with inline actions"
```

---

## Task 7: Guards Page

**Files:**
- Modify: `src/app/(manager)/manager/guards/page.tsx`

- [ ] **Step 1: Replace the placeholder page**

```tsx
// src/app/(manager)/manager/guards/page.tsx
import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { GuardsTable } from '@/components/guards/guards-table'
import type { GuardRow } from '@/components/guards/guards-table'

export default async function ManagerGuardsPage() {
  const session = await requireSession(Role.MANAGER)
  const courtId = session.user.primaryCourtId ?? ''

  const rawGuards = await prisma.user.findMany({
    where: { role: 'GUARD', primaryCourtId: courtId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      guardRank: true,
      isActive: true,
    },
    orderBy: { name: 'asc' },
  })

  // guardRank is always set for GUARD users (backfill migration + createGuard enforces it)
  const guards: GuardRow[] = rawGuards.flatMap(g =>
    g.guardRank ? [{ ...g, guardRank: g.guardRank }] : []
  )

  return <GuardsTable guards={guards} />
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(manager\)/manager/guards/page.tsx
git commit -m "feat(guards): wire up manager guards page"
```

---

## Task 8: Shibutz Types Update

**Files:**
- Modify: `src/components/shibutz/types.ts`

- [ ] **Step 1: Add guardRank to GuardSummary**

Replace the full content of `src/components/shibutz/types.ts`:

```ts
import type { ShiftType, GuardRank } from '@/generated/prisma/client'

export type { ShiftType, GuardRank }

export type GuardSummary = {
  id: string
  name: string
  guardRank: GuardRank | null
}

export type AssignmentSummary = {
  id: string
  userId: string
  userName: string
  isOpeningDuty: boolean
}

/**
 * Key: `${isoDate}-${shiftType}`  e.g. "2024-03-22-MORNING"
 * Value: assignments sorted by creation order (slot 0 first)
 */
export type AssignmentMap = Record<string, AssignmentSummary[]>

/** Max slots to display per shift type */
export type CapacityMap = { MORNING: number; EVENING: number; NIGHT: number }

export type ShibutzGridProps = {
  periodId: string
  periodName: string
  /** ISO date string YYYY-MM-DD */
  startDate: string
  /** ISO date string YYYY-MM-DD */
  endDate: string
  scheduleId: string | null
  assignments: AssignmentMap
  guards: GuardSummary[]
  capacity: CapacityMap
  /** Manager's court id — required for new assignments */
  courtId: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/shibutz/types.ts
git commit -m "feat(shibutz): add guardRank to GuardSummary type"
```

---

## Task 9: Shibutz Components — Rank Filter

**Files:**
- Modify: `src/components/shibutz/guard-picker.tsx`
- Modify: `src/components/shibutz/assignment-cell.tsx`
- Modify: `src/components/shibutz/shift-section.tsx`

- [ ] **Step 1: Update GuardPicker to accept and apply eligibleRanks**

Replace the full content of `src/components/shibutz/guard-picker.tsx`:

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GuardRank } from '@/generated/prisma/client'
import type { GuardSummary } from './types'

type Props = {
  guards: GuardSummary[]
  eligibleRanks: GuardRank[]
  currentUserId: string | null
  onSelect: (guardId: string) => void
  onRemove: () => void
  onClose: () => void
}

export function GuardPicker({ guards, eligibleRanks, currentUserId, onSelect, onRemove, onClose }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Filter by rank eligibility first, then by search query
  const eligible = guards.filter(g => g.guardRank != null && eligibleRanks.includes(g.guardRank))
  const filtered = query.trim()
    ? eligible.filter(g => g.name.includes(query.trim()))
    : eligible

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      ref={panelRef}
      className="absolute z-50 bg-white border border-border rounded-lg shadow-lg w-44 py-1"
      style={{ top: '100%', right: 0 }}
      dir="rtl"
    >
      <div className="px-2 pb-1 pt-1 border-b border-border">
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="חיפוש..."
          className="w-full text-xs px-2 py-1 border border-border rounded-md outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <ul className="max-h-44 overflow-y-auto">
        {eligible.length === 0 && (
          <li className="px-3 py-2 text-xs text-muted-foreground">אין מאבטחים מתאימים לשורה זו</li>
        )}
        {eligible.length > 0 && filtered.length === 0 && (
          <li className="px-3 py-2 text-xs text-muted-foreground">לא נמצא</li>
        )}
        {filtered.map(g => (
          <li
            key={g.id}
            onClick={() => onSelect(g.id)}
            className={cn(
              'px-3 py-1.5 text-xs cursor-pointer hover:bg-accent',
              g.id === currentUserId && 'font-semibold bg-accent/50'
            )}
          >
            {g.name}
          </li>
        ))}
      </ul>

      {currentUserId && (
        <div className="border-t border-border mt-1">
          <button
            onClick={onRemove}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            <X className="w-3 h-3" />
            הסר שיבוץ
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update AssignmentCell to pass slotIndex and eligibleRanks**

Replace the full content of `src/components/shibutz/assignment-cell.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { GuardPicker } from './guard-picker'
import { getEligibleRanks } from './utils'
import { assignGuard, reassignGuard, removeAssignment } from '@/app/(manager)/manager/shibutz/actions'
import type { AssignmentSummary, GuardSummary, ShiftType } from './types'

type Props = {
  closed: boolean
  assignment: AssignmentSummary | null
  guards: GuardSummary[]
  scheduleId: string | null
  periodId: string
  courtId: string
  date: string
  shiftType: ShiftType
  slotIndex: number
  isOpeningDuty: boolean
}

export function AssignmentCell({
  closed, assignment, guards, scheduleId, periodId, courtId, date, shiftType, slotIndex, isOpeningDuty,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  if (closed) {
    return <td className="border border-border bg-black" />
  }

  const eligibleRanks = getEligibleRanks(shiftType, slotIndex)

  function handleSelect(guardId: string) {
    setOpen(false)
    startTransition(async () => {
      if (assignment) {
        await reassignGuard(assignment.id, guardId)
      } else {
        await assignGuard({ scheduleId, periodId, userId: guardId, courtId, date, shiftType, isOpeningDuty })
      }
      router.refresh()
    })
  }

  function handleRemove() {
    if (!assignment) return
    setOpen(false)
    startTransition(async () => {
      await removeAssignment(assignment.id)
      router.refresh()
    })
  }

  return (
    <td
      className={cn(
        'relative border border-border text-center text-xs cursor-pointer select-none transition-colors',
        'min-w-[62px] h-[26px] px-1',
        assignment ? 'hover:bg-accent/60' : 'bg-muted/40 hover:bg-accent/30',
        pending && 'opacity-50 pointer-events-none',
        open && 'ring-2 ring-primary ring-inset'
      )}
      onClick={() => setOpen(v => !v)}
    >
      <span className="truncate block max-w-[58px] mx-auto">
        {assignment?.userName ?? ''}
      </span>

      {open && (
        <GuardPicker
          guards={guards}
          eligibleRanks={eligibleRanks}
          currentUserId={assignment?.userId ?? null}
          onSelect={handleSelect}
          onRemove={handleRemove}
          onClose={() => setOpen(false)}
        />
      )}
    </td>
  )
}
```

- [ ] **Step 3: Update ShiftSection to pass slotIndex to AssignmentCell**

In `src/components/shibutz/shift-section.tsx`, find the `<AssignmentCell` JSX (around line 87) and add the `slotIndex` prop:

```tsx
return (
  <AssignmentCell
    key={day.iso}
    closed={isClosedCell(day.dayOfWeek, shiftType)}
    assignment={assignment}
    guards={guards}
    scheduleId={scheduleId}
    periodId={periodId}
    courtId={courtId}
    date={day.iso}
    shiftType={shiftType}
    slotIndex={slotIndex}
    isOpeningDuty={isOpening}
  />
)
```

- [ ] **Step 4: Commit**

```bash
git add src/components/shibutz/guard-picker.tsx src/components/shibutz/assignment-cell.tsx src/components/shibutz/shift-section.tsx
git commit -m "feat(shibutz): filter GuardPicker by rank eligibility per row"
```

---

## Task 10: Shibutz Page — Include guardRank in Query

**Files:**
- Modify: `src/app/(manager)/manager/shibutz/page.tsx`

- [ ] **Step 1: Add guardRank to the guards select**

In `src/app/(manager)/manager/shibutz/page.tsx`, find the guards query (around line 56):

```ts
const guards = await prisma.user.findMany({
  where: { role: 'GUARD', isActive: true },
  select: { id: true, name: true },
  orderBy: { name: 'asc' },
})
```

Update it to include `guardRank`:

```ts
const guards = await prisma.user.findMany({
  where: { role: 'GUARD', isActive: true },
  select: { id: true, name: true, guardRank: true },
  orderBy: { name: 'asc' },
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(manager\)/manager/shibutz/page.tsx
git commit -m "feat(shibutz): include guardRank in guards query"
```
