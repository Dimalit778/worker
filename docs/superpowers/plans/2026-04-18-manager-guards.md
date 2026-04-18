# Manager Guards Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the manager guards page with list, add, edit, and delete, plus a `mustChangePassword` flow so newly created guards are forced to change their default password on first login.

**Architecture:** Schema-first → auth plumbing → middleware TDD → server actions → client components → page wiring. Guards are `Employee` records linked to `User` accounts. Creating a guard provisions both in a single transaction with a default password of `123456` and `mustChangePassword: true`. Server component fetches data; `GuardsTable` client component owns modal/delete state; server actions handle all mutations.

**Tech Stack:** Next.js App Router, React 19, Prisma, bcryptjs, Tailwind CSS v4, Lucide icons, Vitest.

**Spec reference:** `docs/superpowers/specs/2026-04-18-manager-guards-v2-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add `mustChangePassword Boolean @default(false)` to `User` |
| Modify | `src/types/next-auth.d.ts` | Add `mustChangePassword: boolean` to `User`, `JWT`, `Session` |
| Modify | `src/lib/auth.ts` | Read + persist + expose `mustChangePassword` in auth callbacks |
| Modify | `src/lib/middleware.ts` | Add `mustChangePassword` param + redirect to `/change-password` |
| Modify | `src/proxy.ts` | Pass `mustChangePassword` from JWT token to `resolveRedirect` |
| Modify | `tests/middleware-logic.test.ts` | Add tests for `mustChangePassword` redirect |
| Create | `src/features/guards/actions.ts` | `createGuard`, `updateGuard`, `deleteGuard` server actions |
| Create | `src/features/guards/components/guard-modal.tsx` | Add/edit modal — name, email, position fields |
| Create | `src/features/guards/components/guards-table.tsx` | Table + delete confirm + `GuardRow` type export |
| Modify | `src/app/(manager)/manager/guards/page.tsx` | Server component — fetch employees, render `GuardsTable` |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `mustChangePassword` to the `User` model**

In `prisma/schema.prisma`, find the `User` model and add the field after `isActive`:

```prisma
model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String
  systemRole   SystemRole @default(EMPLOYEE)
  isActive     Boolean    @default(true)
  mustChangePassword Boolean @default(false)

  employeeId   String?    @unique
  employee     Employee?  @relation(fields: [employeeId], references: [id], onDelete: SetNull)

  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  periodsCreated     SchedulingPeriod[] @relation("PeriodCreatedBy")
  schedulesGenerated Schedule[]         @relation("ScheduleGeneratedBy")
  warningActions     ScheduleWarning[]  @relation("WarningCreatedBy")

  accounts Account[]
  sessions Session[]

  @@index([systemRole])
}
```

- [ ] **Step 2: Create and apply the migration**

```bash
cd /Users/dimalitvinov/Mac/Dev/Projects/worker
pnpm exec prisma migrate dev --name add_must_change_password
```

Expected output includes: `Applied 1 migration(s).` and `✔ Generated Prisma Client`

- [ ] **Step 3: Verify the field appears in the generated client**

```bash
grep "mustChangePassword" src/generated/prisma/models.ts | head -5
```

Expected: a line containing `mustChangePassword`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add mustChangePassword field to User"
```

---

## Task 2: NextAuth Types + Auth Callbacks

**Files:**
- Modify: `src/types/next-auth.d.ts`
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Add `mustChangePassword` to NextAuth type declarations**

Replace the full content of `src/types/next-auth.d.ts`:

```ts
import type { DefaultSession } from 'next-auth';
import type { SystemRole } from '@/generated/prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      systemRole: SystemRole;
      primaryCourtId: string | null;
      mustChangePassword: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    systemRole: SystemRole;
    primaryCourtId: string | null;
    mustChangePassword: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    systemRole: SystemRole;
    primaryCourtId: string | null;
    mustChangePassword: boolean;
  }
}
```

- [ ] **Step 2: Update `authorize` in `src/lib/auth.ts` to return `mustChangePassword`**

Find the `authorize` function's return statement (currently returning an object with `id`, `email`, `name`, `systemRole`, `primaryCourtId`). Replace it:

```ts
return {
  id: user.id,
  email: user.email,
  name,
  systemRole: user.systemRole,
  primaryCourtId,
  mustChangePassword: user.mustChangePassword,
};
```

- [ ] **Step 3: Update the `jwt` callback to persist `mustChangePassword`**

Find the `jwt` callback and replace it entirely:

```ts
async jwt({ token, user }) {
  if (user) {
    token.systemRole = user.systemRole;
    token.primaryCourtId = user.primaryCourtId;
    token.mustChangePassword = user.mustChangePassword;
  } else {
    const migrated = systemRoleFromLegacyJwt(token as { systemRole?: SystemRole; role?: unknown });
    if (migrated && !token.systemRole) {
      token.systemRole = migrated;
    }
    if (token.mustChangePassword === undefined) {
      token.mustChangePassword = false;
    }
  }
  return token;
},
```

- [ ] **Step 4: Update the `session` callback to expose `mustChangePassword`**

Find the `session` callback and replace it:

```ts
async session({ session, token }) {
  if (session.user && token.sub) {
    session.user.id = token.sub;
    session.user.systemRole = token.systemRole;
    session.user.primaryCourtId = token.primaryCourtId;
    session.user.mustChangePassword = token.mustChangePassword ?? false;
  }
  return session;
},
```

- [ ] **Step 5: Check for TypeScript errors**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/next-auth.d.ts src/lib/auth.ts
git commit -m "feat: propagate mustChangePassword through NextAuth jwt and session"
```

---

## Task 3: Middleware — Force Password Change (TDD)

**Files:**
- Modify: `tests/middleware-logic.test.ts`
- Modify: `src/lib/middleware.ts`
- Modify: `src/proxy.ts`

- [ ] **Step 1: Write failing tests for `mustChangePassword` redirect**

Append these tests to `tests/middleware-logic.test.ts` (inside the existing `describe('resolveRedirect', ...)` block, after the last `it(...)` call):

```ts
  // mustChangePassword redirect
  describe('mustChangePassword', () => {
    it('redirects authenticated EMPLOYEE with mustChangePassword to /change-password', () => {
      expect(resolveRedirect('/user', SystemRole.EMPLOYEE, true)).toBe('/change-password');
    });

    it('redirects authenticated MANAGER with mustChangePassword to /change-password', () => {
      expect(resolveRedirect('/manager', SystemRole.MANAGER, true)).toBe('/change-password');
    });

    it('does not redirect if already on /change-password', () => {
      expect(resolveRedirect('/change-password', SystemRole.EMPLOYEE, true)).toBeNull();
    });

    it('does not redirect api/auth routes even with mustChangePassword', () => {
      expect(resolveRedirect('/api/auth/session', SystemRole.EMPLOYEE, true)).toBeNull();
    });

    it('does not redirect unauthenticated user (null role) even with mustChangePassword true', () => {
      expect(resolveRedirect('/user', null, true)).toBe('/login');
    });

    it('returns null for normal authenticated user with mustChangePassword false', () => {
      expect(resolveRedirect('/user', SystemRole.EMPLOYEE, false)).toBeNull();
    });

    it('returns null when mustChangePassword omitted (default false)', () => {
      expect(resolveRedirect('/user', SystemRole.EMPLOYEE)).toBeNull();
    });
  });
```

- [ ] **Step 2: Run the tests — expect failures**

```bash
pnpm exec vitest run tests/middleware-logic.test.ts
```

Expected: TypeScript errors or test failures because `resolveRedirect` doesn't yet accept a third argument.

- [ ] **Step 3: Update `resolveRedirect` in `src/lib/middleware.ts`**

Replace the full file content:

```ts
import { SystemRole } from '@/generated/prisma/client';

function homeFor(role: SystemRole): string {
  switch (role) {
    case SystemRole.EMPLOYEE:
      return '/user';
    case SystemRole.MANAGER:
      return '/manager';
    case SystemRole.ADMIN:
      return '/admin';
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unhandled role: ${String(_exhaustive)}`);
    }
  }
}

export function resolveRedirect(
  pathname: string,
  role: SystemRole | null,
  mustChangePassword = false,
): string | null {
  // Force password change for authenticated users
  if (
    role &&
    mustChangePassword &&
    !pathname.startsWith('/change-password') &&
    !pathname.startsWith('/api/auth')
  ) {
    return '/change-password';
  }

  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return null;
  }

  // Root redirect
  if (pathname === '/') {
    if (!role) return '/login';
    return homeFor(role);
  }

  // User (employee) routes
  if (pathname.startsWith('/user')) {
    if (!role) return '/login';
    if (role !== SystemRole.EMPLOYEE) return homeFor(role);
    return null;
  }

  // Manager routes
  if (pathname.startsWith('/manager')) {
    if (!role) return '/login';
    if (role !== SystemRole.MANAGER) return homeFor(role);
    return null;
  }

  // Admin routes
  if (pathname.startsWith('/admin')) {
    if (!role) return '/login';
    if (role !== SystemRole.ADMIN) return homeFor(role);
    return null;
  }

  return null;
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
pnpm exec vitest run tests/middleware-logic.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Update `src/proxy.ts` to pass `mustChangePassword` to `resolveRedirect`**

Replace the full file content:

```ts
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { SystemRole } from '@/generated/prisma/client';
import { resolveRedirect } from '@/lib/middleware';

export default withAuth(
  function middleware(req) {
    const role = (req.nextauth.token?.systemRole ?? null) as SystemRole | null;
    const mustChangePassword = (req.nextauth.token?.mustChangePassword ?? false) as boolean;
    const redirect = resolveRedirect(req.nextUrl.pathname, role, mustChangePassword);

    if (redirect) {
      return NextResponse.redirect(new URL(redirect, req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: () => true,
    },
  },
);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 6: Run full test suite to check nothing is broken**

```bash
pnpm exec vitest run
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/middleware-logic.test.ts src/lib/middleware.ts src/proxy.ts
git commit -m "feat: redirect users with mustChangePassword to /change-password"
```

---

## Task 4: Guards Server Actions

**Files:**
- Create: `src/features/guards/actions.ts`

- [ ] **Step 1: Create the actions file**

Create `src/features/guards/actions.ts` with this exact content:

```ts
'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { Position, SystemRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { requireSession } from '@/lib/auth-helpers'

const DEFAULT_PASSWORD = '123456'

type CreateGuardParams = {
  name: string
  email: string
  position: Position
}

type UpdateGuardParams = {
  employeeId: string
  name: string
  email: string
  position: Position
  isActive: boolean
}

type DeleteGuardParams = {
  employeeId: string
  force?: boolean
}

export async function createGuard(
  params: CreateGuardParams,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER)
  const courtId = session.user.primaryCourtId
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' }

  const { name, email, position } = params

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return { error: 'אימייל כבר קיים במערכת' }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12)

  await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: { name, position, primaryCourtId: courtId, isActive: true },
    })
    await tx.user.create({
      data: {
        email,
        passwordHash,
        systemRole: SystemRole.EMPLOYEE,
        mustChangePassword: true,
        isActive: true,
        employeeId: employee.id,
      },
    })
    await tx.courtEligibility.create({
      data: { employeeId: employee.id, courtId },
    })
  })

  revalidatePath('/manager/guards')
  return { ok: true }
}

export async function updateGuard(
  params: UpdateGuardParams,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER)
  const courtId = session.user.primaryCourtId

  const { employeeId, name, email, position, isActive } = params

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, primaryCourtId: courtId ?? '' },
  })
  if (!employee) return { error: 'מאבטח לא נמצא' }

  const duplicate = await prisma.user.findFirst({
    where: { email, NOT: { employeeId } },
  })
  if (duplicate) return { error: 'אימייל כבר קיים במערכת' }

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: { name, position, isActive },
    })
    await tx.user.updateMany({
      where: { employeeId },
      data: { email },
    })
  })

  revalidatePath('/manager/guards')
  return { ok: true }
}

export async function deleteGuard(params: DeleteGuardParams): Promise<
  { ok: true } | { needsConfirm: true; assignmentCount: number } | { error: string }
> {
  const session = await requireSession(SystemRole.MANAGER)
  const courtId = session.user.primaryCourtId

  const { employeeId, force } = params

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, primaryCourtId: courtId ?? '' },
  })
  if (!employee) return { error: 'מאבטח לא נמצא' }

  const assignmentCount = await prisma.shiftAssignment.count({ where: { employeeId } })

  if (assignmentCount > 0 && !force) {
    return { needsConfirm: true, assignmentCount }
  }

  await prisma.$transaction(async (tx) => {
    // User has onDelete: SetNull on Employee — must delete User first to avoid orphan
    await tx.user.deleteMany({ where: { employeeId } })
    // ShiftAssignments cascade-delete automatically via FK onDelete: Cascade
    await tx.employee.delete({ where: { id: employeeId } })
  })

  revalidatePath('/manager/guards')
  return { ok: true }
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/guards/actions.ts
git commit -m "feat(guards): add createGuard, updateGuard, deleteGuard server actions"
```

---

## Task 5: GuardModal Component

**Files:**
- Create: `src/features/guards/components/guard-modal.tsx`

- [ ] **Step 1: Create the modal component**

Create `src/features/guards/components/guard-modal.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Position } from '@/generated/prisma/client'
import { createGuard, updateGuard } from '@/features/guards/actions'
import type { GuardRow } from './guards-table'

const POSITION_HE: Record<Position, string> = {
  GUARD: 'מאבטח',
  BAKAR: 'בקר',
  SHIFT_MANAGER: 'אחמ״ש',
  FACILITY_OFFICER: 'קצין מתקן',
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
    const position = fd.get('position') as Position
    const isActive = fd.has('isActive')

    setError(null)
    startTransition(async () => {
      const result = isEdit
        ? await updateGuard({ employeeId: guard.id, name, email, position, isActive })
        : await createGuard({ name, email, position })

      if ('error' in result) {
        setError(result.error)
      } else {
        onClose()
        router.refresh()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">
            {isEdit ? 'עריכת מאבטח' : 'הוספת מאבטח'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">שם מלא *</label>
            <input
              name="name"
              defaultValue={guard?.name ?? ''}
              required
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium mb-1">תפקיד *</label>
            <select
              name="position"
              defaultValue={guard?.position ?? Position.GUARD}
              required
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              {(Object.keys(POSITION_HE) as Position[]).map(pos => (
                <option key={pos} value={pos}>{POSITION_HE[pos]}</option>
              ))}
            </select>
          </div>

          {isEdit && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                id="isActive"
                defaultChecked={guard.isActive}
                className="w-4 h-4"
              />
              <label htmlFor="isActive" className="text-sm font-medium">פעיל</label>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

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
git add src/features/guards/components/guard-modal.tsx
git commit -m "feat(guards): add GuardModal component"
```

---

## Task 6: GuardsTable Component

**Files:**
- Create: `src/features/guards/components/guards-table.tsx`

- [ ] **Step 1: Create the table component**

Create `src/features/guards/components/guards-table.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Position } from '@/generated/prisma/client'
import { deleteGuard } from '@/features/guards/actions'
import { GuardModal } from './guard-modal'

export type GuardRow = {
  id: string           // Employee.id
  name: string
  position: Position
  isActive: boolean
  email: string | null
  mustChangePassword: boolean
}

const POSITION_HE: Record<Position, string> = {
  GUARD: 'מאבטח',
  BAKAR: 'בקר',
  SHIFT_MANAGER: 'אחמ״ש',
  FACILITY_OFFICER: 'קצין מתקן',
}

const POSITION_STYLE: Record<Position, string> = {
  SHIFT_MANAGER: 'bg-slate-800 text-white',
  BAKAR: 'bg-blue-100 text-blue-800',
  GUARD: 'bg-slate-100 text-slate-600',
  FACILITY_OFFICER: 'bg-orange-100 text-orange-800',
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
      const result = await deleteGuard({ employeeId: guard.id })
      if ('needsConfirm' in result) {
        setDeleteTarget({ id: guard.id, name: guard.name, assignmentCount: result.assignmentCount })
      } else if ('ok' in result) {
        router.refresh()
      }
    })
  }

  function handleForceDelete() {
    if (!deleteTarget) return
    startDeleteTransition(async () => {
      await deleteGuard({ employeeId: deleteTarget.id, force: true })
      setDeleteTarget(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">מאבטחים</h1>
        <button
          onClick={openAdd}
          className="bg-foreground text-background text-sm px-4 py-2 rounded-md hover:opacity-90"
        >
          + הוסף מאבטח
        </button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 text-right">
              <th className="px-4 py-3 font-medium border-b border-border w-10">#</th>
              <th className="px-4 py-3 font-medium border-b border-border">שם</th>
              <th className="px-4 py-3 font-medium border-b border-border">תפקיד</th>
              <th className="px-4 py-3 font-medium border-b border-border">אימייל</th>
              <th className="px-4 py-3 font-medium border-b border-border">סטטוס</th>
              <th className="px-4 py-3 border-b border-border w-16"></th>
            </tr>
          </thead>
          <tbody>
            {guards.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  אין מאבטחים. לחץ על &quot;+ הוסף מאבטח&quot; להוספה.
                </td>
              </tr>
            )}
            {guards.map((guard, i) => (
              <tr
                key={guard.id}
                className={cn(
                  'border-b border-border last:border-0 hover:bg-muted/20 transition-colors',
                  !guard.isActive && 'opacity-50',
                )}
              >
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-medium">{guard.name}</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', POSITION_STYLE[guard.position])}>
                    {POSITION_HE[guard.position]}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground" dir="ltr">{guard.email ?? '—'}</td>
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

      {modalOpen && <GuardModal guard={editingGuard} onClose={closeModal} />}

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
                disabled={deletePending}
                className="flex-1 bg-destructive text-destructive-foreground rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
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
git add src/features/guards/components/guards-table.tsx
git commit -m "feat(guards): add GuardsTable component with inline edit and delete"
```

---

## Task 7: Guards Page

**Files:**
- Modify: `src/app/(manager)/manager/guards/page.tsx`

- [ ] **Step 1: Replace the placeholder page**

Replace the full content of `src/app/(manager)/manager/guards/page.tsx`:

```tsx
import { requireSession } from '@/lib/auth-helpers'
import { SystemRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { GuardsTable } from '@/features/guards/components/guards-table'
import type { GuardRow } from '@/features/guards/components/guards-table'

export default async function ManagerGuardsPage() {
  const session = await requireSession(SystemRole.MANAGER)
  const courtId = session.user.primaryCourtId ?? ''

  const employees = await prisma.employee.findMany({
    where: { primaryCourtId: courtId },
    include: { user: { select: { email: true, mustChangePassword: true } } },
    orderBy: { name: 'asc' },
  })

  const guards: GuardRow[] = employees.map(e => ({
    id: e.id,
    name: e.name,
    position: e.position,
    isActive: e.isActive,
    email: e.user?.email ?? null,
    mustChangePassword: e.user?.mustChangePassword ?? false,
  }))

  return <GuardsTable guards={guards} />
}
```

- [ ] **Step 2: Run full TypeScript check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run the dev server and manually verify the page**

```bash
pnpm dev
```

Open `http://localhost:3000` and log in as the manager (`tomer@gmail.com` / `tomer123`). Navigate to `/manager/guards`. Verify:
- Table shows all seeded employees for the court
- "+ הוסף מאבטח" button opens the add modal
- Filling name + email + position and submitting creates a new guard (appears in table)
- Clicking the edit icon opens the edit modal with prefilled values
- Clicking the delete icon (for a guard with no assignments) removes the row immediately
- An employee with assignments triggers the confirmation dialog

- [ ] **Step 4: Commit**

```bash
git add src/app/\(manager\)/manager/guards/page.tsx
git commit -m "feat(guards): wire up manager guards page"
```
