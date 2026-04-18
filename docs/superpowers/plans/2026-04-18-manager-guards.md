# Manager Guards Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch guards and managers to login with employee number + password; build the manager guards page (list / add / edit / delete) where creating a guard auto-generates an employee number and sets it as the initial password; force a password change on first login.

**Architecture:** Schema-first (add `employeeNumber`, make `email` nullable, add `mustChangePassword`) → update auth to accept employee-number-or-email as identifier → update login form → update seed → TDD middleware redirect → server actions with auto-number generation → client components → page wiring.

**Tech Stack:** Next.js App Router, React 19, Prisma, bcryptjs, Tailwind CSS v4, Lucide icons, Vitest.

**Spec reference:** `docs/superpowers/specs/2026-04-18-manager-guards-v2-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | `email String? @unique`, add `employeeNumber String? @unique`, add `mustChangePassword Boolean @default(false)` |
| Modify | `prisma/seed.ts` | Assign `employeeNumber` to non-admin users; remove required `email` from guard creation |
| Modify | `src/types/next-auth.d.ts` | Add `employeeNumber: string \| null` and `mustChangePassword: boolean` |
| Modify | `src/lib/auth.ts` | Accept `identifier` credential (employee number or email); persist `employeeNumber` + `mustChangePassword` in JWT/session |
| Modify | `src/app/(auth)/login/LoginForm.tsx` | Change email field to `identifier` field (label: "מספר עובד / אימייל") |
| Modify | `src/lib/middleware.ts` | Add `mustChangePassword` param + redirect to `/change-password` |
| Modify | `src/proxy.ts` | Pass `mustChangePassword` from JWT to `resolveRedirect` |
| Modify | `tests/middleware-logic.test.ts` | Add tests for `mustChangePassword` redirect |
| Create | `src/features/guards/actions.ts` | `createGuard` (auto-generate number), `updateGuard`, `deleteGuard` |
| Create | `src/features/guards/components/guard-modal.tsx` | Add modal (name + position); edit modal (name + position + isActive + read-only number) |
| Create | `src/features/guards/components/guards-table.tsx` | Table with employee-number column; delete confirm; exports `GuardRow` |
| Modify | `src/app/(manager)/manager/guards/page.tsx` | Server component — fetch employees with user data, render `GuardsTable` |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update the `User` model**

In `prisma/schema.prisma`, replace the `User` model block with:

```prisma
model User {
  id                 String     @id @default(cuid())
  email              String?    @unique
  employeeNumber     String?    @unique
  passwordHash       String
  systemRole         SystemRole @default(EMPLOYEE)
  isActive           Boolean    @default(true)
  mustChangePassword Boolean    @default(false)

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
pnpm exec prisma migrate dev --name add_employee_number_and_must_change_password
```

Expected: `Applied 1 migration(s).` and `✔ Generated Prisma Client`

- [ ] **Step 3: Verify the fields appear in the generated client**

```bash
grep -E "employeeNumber|mustChangePassword" src/generated/prisma/models.ts | head -6
```

Expected: lines containing both `employeeNumber` and `mustChangePassword`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add employeeNumber, mustChangePassword; make email optional on User"
```

---

## Task 2: Update Seed Data

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Update `createUserWithEmployee` to accept `employeeNumber` and optional `email`**

Find the `createUserWithEmployee` function and replace its signature and `user.create` call:

```ts
async function createUserWithEmployee(params: {
  email?: string;
  employeeNumber?: string;
  password: string;
  systemRole: SystemRole;
  name: string;
  phone?: string;
  position: Position;
  primaryCourtId?: string;
  employeeCode?: string;
  mustChangePassword?: boolean;
}) {
  const passwordHash = await bcrypt.hash(params.password, 12);

  const employee = await prisma.employee.create({
    data: {
      employeeCode: params.employeeCode,
      name: params.name,
      phone: params.phone,
      position: params.position,
      primaryCourtId: params.primaryCourtId,
      isActive: true,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: params.email ?? null,
      employeeNumber: params.employeeNumber ?? null,
      passwordHash,
      systemRole: params.systemRole,
      isActive: true,
      mustChangePassword: params.mustChangePassword ?? false,
      employeeId: employee.id,
    },
  });

  if (params.primaryCourtId) {
    await prisma.courtEligibility.create({
      data: { employeeId: employee.id, courtId: params.primaryCourtId },
    });
  }

  return { user, employee };
}
```

- [ ] **Step 2: Assign `employeeNumber` to manager, admin, and all employee seed entries**

Find the manager creation call and update it:

```ts
const manager = await createUserWithEmployee({
  email: 'tomer@gmail.com',
  employeeNumber: '1001',
  password: 'tomer123',
  systemRole: SystemRole.MANAGER,
  name: 'תומר לוי',
  position: Position.SHIFT_MANAGER,
  primaryCourtId: courtA.id,
  employeeCode: 'EMP-001',
});
```

Find the admin creation call and update it (admin keeps email, no employee number):

```ts
await createUserWithEmployee({
  email: 'admin@gmail.com',
  password: 'admin123',
  systemRole: SystemRole.ADMIN,
  name: 'מנהל ראשי',
  position: Position.FACILITY_OFFICER,
  employeeCode: 'EMP-002',
});
```

Find the `for (const emp of employeeData)` loop and replace it so each employee gets a sequential number starting at 1002:

```ts
let employeeCounter = 100;
let empNumberCounter = 1002;

for (const emp of employeeData) {
  await createUserWithEmployee({
    email: emp.email,
    employeeNumber: String(empNumberCounter++),
    password: 'worker123',
    systemRole: SystemRole.EMPLOYEE,
    name: emp.name.trim(),
    position: emp.position,
    primaryCourtId: courtA.id,
    employeeCode: `EMP-${employeeCounter++}`,
  });
}
```

- [ ] **Step 3: Run the seed to verify**

```bash
pnpm db:seed
```

Expected: `Seed complete.` with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: add employeeNumber to seed users"
```

---

## Task 3: NextAuth Types + Auth Callbacks

**Files:**
- Modify: `src/types/next-auth.d.ts`
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Update `src/types/next-auth.d.ts`**

Replace the full file:

```ts
import type { DefaultSession } from 'next-auth';
import type { SystemRole } from '@/generated/prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      systemRole: SystemRole;
      primaryCourtId: string | null;
      employeeNumber: string | null;
      mustChangePassword: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    systemRole: SystemRole;
    primaryCourtId: string | null;
    employeeNumber: string | null;
    mustChangePassword: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    systemRole: SystemRole;
    primaryCourtId: string | null;
    employeeNumber: string | null;
    mustChangePassword: boolean;
  }
}
```

- [ ] **Step 2: Update `authorize` in `src/lib/auth.ts` to accept `identifier` and look up by employee number or email**

In `src/lib/auth.ts`, replace the `CredentialsProvider` block:

```ts
CredentialsProvider({
  name: 'credentials',
  credentials: {
    identifier: { label: 'Employee Number / Email', type: 'text' },
    password: { label: 'Password', type: 'password' },
  },
  async authorize(credentials) {
    if (!credentials?.identifier || !credentials?.password) return null;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { employeeNumber: credentials.identifier },
          { email: credentials.identifier },
        ],
      },
      include: { employee: true },
    });

    if (!user || !user.isActive) return null;

    const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!isValid) return null;

    const primaryCourtId = user.employee?.primaryCourtId ?? null;
    const name = user.employee?.name ?? user.email ?? user.employeeNumber ?? '';

    return {
      id: user.id,
      email: user.email,
      name,
      systemRole: user.systemRole,
      primaryCourtId,
      employeeNumber: user.employeeNumber ?? null,
      mustChangePassword: user.mustChangePassword,
    };
  },
}),
```

- [ ] **Step 3: Update the `jwt` callback**

Replace the `jwt` callback:

```ts
async jwt({ token, user }) {
  if (user) {
    token.systemRole = user.systemRole;
    token.primaryCourtId = user.primaryCourtId;
    token.employeeNumber = user.employeeNumber;
    token.mustChangePassword = user.mustChangePassword;
  } else {
    const migrated = systemRoleFromLegacyJwt(token as { systemRole?: SystemRole; role?: unknown });
    if (migrated && !token.systemRole) {
      token.systemRole = migrated;
    }
    if (token.mustChangePassword === undefined) token.mustChangePassword = false;
    if (token.employeeNumber === undefined) token.employeeNumber = null;
  }
  return token;
},
```

- [ ] **Step 4: Update the `session` callback**

Replace the `session` callback:

```ts
async session({ session, token }) {
  if (session.user && token.sub) {
    session.user.id = token.sub;
    session.user.systemRole = token.systemRole;
    session.user.primaryCourtId = token.primaryCourtId;
    session.user.employeeNumber = token.employeeNumber ?? null;
    session.user.mustChangePassword = token.mustChangePassword ?? false;
  }
  return session;
},
```

- [ ] **Step 5: Check TypeScript**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/next-auth.d.ts src/lib/auth.ts
git commit -m "feat: switch auth to accept employeeNumber or email as identifier"
```

---

## Task 4: Update Login Form

**Files:**
- Modify: `src/app/(auth)/login/LoginForm.tsx`

- [ ] **Step 1: Replace the email field with a generic identifier field**

Replace the full file content:

```tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function LoginForm() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn('credentials', {
      identifier,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('מזהה או סיסמה שגויים');
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      <div className="space-y-2">
        <Label htmlFor="identifier">מספר עובד / אימייל</Label>
        <Input
          id="identifier"
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="1001"
          required
          autoComplete="username"
          dir="ltr"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">סיסמה</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'מתחבר...' : 'התחבר'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Verify login works manually**

```bash
pnpm dev
```

Open `http://localhost:3000/login`. Verify:
- Manager logs in with `1001` / `tomer123` → lands on `/manager`
- Admin logs in with `admin@gmail.com` / `admin123` → lands on `/admin`
- Wrong credentials shows "מזהה או סיסמה שגויים"

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/login/LoginForm.tsx
git commit -m "feat: update login form to use employee number or email"
```

---

## Task 5: Middleware — Force Password Change (TDD)

**Files:**
- Modify: `tests/middleware-logic.test.ts`
- Modify: `src/lib/middleware.ts`
- Modify: `src/proxy.ts`

- [ ] **Step 1: Write failing tests**

Append inside the existing `describe('resolveRedirect', ...)` block in `tests/middleware-logic.test.ts`, after the last `it(...)` call:

```ts
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

    it('does not redirect unauthenticated user even when mustChangePassword is true', () => {
      expect(resolveRedirect('/user', null, true)).toBe('/login');
    });

    it('returns null for authenticated user with mustChangePassword false', () => {
      expect(resolveRedirect('/user', SystemRole.EMPLOYEE, false)).toBeNull();
    });

    it('returns null when mustChangePassword omitted (defaults false)', () => {
      expect(resolveRedirect('/user', SystemRole.EMPLOYEE)).toBeNull();
    });
  });
```

- [ ] **Step 2: Run tests — expect failures**

```bash
pnpm exec vitest run tests/middleware-logic.test.ts
```

Expected: failures because `resolveRedirect` does not accept a third argument yet.

- [ ] **Step 3: Update `src/lib/middleware.ts`**

Replace the full file:

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
  // Authenticated users with mustChangePassword go to /change-password
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

- [ ] **Step 5: Update `src/proxy.ts`**

Replace the full file:

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

- [ ] **Step 6: Run full test suite**

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

## Task 6: Guards Server Actions

**Files:**
- Create: `src/features/guards/actions.ts`

- [ ] **Step 1: Create the actions file**

Create `src/features/guards/actions.ts`:

```ts
'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { Position, SystemRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { requireSession } from '@/lib/auth-helpers'

type CreateGuardParams = {
  name: string
  position: Position
}

type UpdateGuardParams = {
  employeeId: string
  name: string
  position: Position
  isActive: boolean
}

type DeleteGuardParams = {
  employeeId: string
  force?: boolean
}

async function generateNextEmployeeNumber(): Promise<string> {
  const users = await prisma.user.findMany({
    where: { employeeNumber: { not: null } },
    select: { employeeNumber: true },
  })
  const max = users.reduce((acc, u) => {
    const n = parseInt(u.employeeNumber!, 10)
    return isNaN(n) ? acc : Math.max(acc, n)
  }, 1000)
  return String(max + 1)
}

export async function createGuard(
  params: CreateGuardParams,
): Promise<{ ok: true; employeeNumber: string } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER)
  const courtId = session.user.primaryCourtId
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' }

  const { name, position } = params

  const employeeNumber = await generateNextEmployeeNumber()
  const passwordHash = await bcrypt.hash(employeeNumber, 12)

  await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.create({
      data: { name, position, primaryCourtId: courtId, isActive: true },
    })
    await tx.user.create({
      data: {
        employeeNumber,
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
  return { ok: true, employeeNumber }
}

export async function updateGuard(
  params: UpdateGuardParams,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER)
  const courtId = session.user.primaryCourtId

  const { employeeId, name, position, isActive } = params

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, primaryCourtId: courtId ?? '' },
  })
  if (!employee) return { error: 'מאבטח לא נמצא' }

  await prisma.employee.update({
    where: { id: employeeId },
    data: { name, position, isActive },
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
    // User has onDelete: SetNull — must delete User before Employee
    await tx.user.deleteMany({ where: { employeeId } })
    // ShiftAssignments cascade via FK onDelete: Cascade on Employee
    await tx.employee.delete({ where: { id: employeeId } })
  })

  revalidatePath('/manager/guards')
  return { ok: true }
}
```

- [ ] **Step 2: Check TypeScript**

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

## Task 7: GuardModal Component

**Files:**
- Create: `src/features/guards/components/guard-modal.tsx`

- [ ] **Step 1: Create the modal**

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
  const [createdNumber, setCreatedNumber] = useState<string | null>(null)
  const isEdit = guard !== null

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const name = fd.get('name') as string
    const position = fd.get('position') as Position
    const isActive = fd.has('isActive')

    setError(null)
    startTransition(async () => {
      if (isEdit) {
        const result = await updateGuard({ employeeId: guard.id, name, position, isActive })
        if ('error' in result) {
          setError(result.error)
        } else {
          onClose()
          router.refresh()
        }
      } else {
        const result = await createGuard({ name, position })
        if ('error' in result) {
          setError(result.error)
        } else {
          setCreatedNumber(result.employeeNumber)
          router.refresh()
        }
      }
    })
  }

  // After successful creation: show the generated employee number
  if (createdNumber) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <h2 className="font-bold text-lg">מאבטח נוסף בהצלחה</h2>
          <p className="text-sm text-muted-foreground">
            מספר העובד שנוצר הוא:
          </p>
          <p className="text-3xl font-bold text-center tracking-widest" dir="ltr">
            {createdNumber}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            הסיסמה הראשונית זהה למספר העובד. המאבטח יתבקש לשנות אותה בכניסה הראשונה.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-foreground text-background rounded-md py-2 text-sm font-medium hover:opacity-90"
          >
            סגור
          </button>
        </div>
      </div>
    )
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

        {isEdit && guard.employeeNumber && (
          <div className="mb-4 px-3 py-2 bg-muted/40 rounded-md text-sm">
            <span className="text-muted-foreground">מספר עובד: </span>
            <span className="font-mono font-semibold" dir="ltr">{guard.employeeNumber}</span>
          </div>
        )}

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
git commit -m "feat(guards): add GuardModal with employee number display on create"
```

---

## Task 8: GuardsTable Component

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
  employeeNumber: string | null
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
              <th className="px-4 py-3 font-medium border-b border-border">מספר עובד</th>
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
                <td className="px-4 py-3 font-mono text-muted-foreground" dir="ltr">
                  {guard.employeeNumber ?? '—'}
                </td>
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
git commit -m "feat(guards): add GuardsTable with employee number column"
```

---

## Task 9: Guards Page

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
    include: { user: { select: { employeeNumber: true } } },
    orderBy: { name: 'asc' },
  })

  const guards: GuardRow[] = employees.map(e => ({
    id: e.id,
    name: e.name,
    position: e.position,
    isActive: e.isActive,
    employeeNumber: e.user?.employeeNumber ?? null,
  }))

  return <GuardsTable guards={guards} />
}
```

- [ ] **Step 2: Run full TypeScript check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
pnpm exec vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Manual verification**

```bash
pnpm dev
```

Verify end-to-end:
1. Log in as manager (`1001` / `tomer123`) → lands on `/manager`
2. Navigate to `/manager/guards` → see the table with all court employees
3. Click "+ הוסף מאבטח" → modal with שם מלא + תפקיד fields only
4. Submit → success screen shows the generated employee number (e.g. `1016`) and notes the password is the same
5. Close → new guard appears in the table
6. Log out; log in as the new guard using their employee number and that number as password → redirected to `/change-password`
7. Edit an existing guard → modal shows employee number as read-only, can change name/position/active
8. Delete a guard with no assignments → row disappears immediately
9. Delete a guard with assignments → confirmation dialog shows count, then deletes on confirm

- [ ] **Step 5: Commit**

```bash
git add src/app/\(manager\)/manager/guards/page.tsx
git commit -m "feat(guards): wire up manager guards page"
```
