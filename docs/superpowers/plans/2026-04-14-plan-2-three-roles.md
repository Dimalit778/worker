# Phase 2 — Three-Role Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the app from 2 roles (GUARD, MANAGER) to 3 roles (GUARD, MANAGER, ADMIN) with correct route protection, layout shells, and seed data.

**Architecture:** Single Prisma enum value added (`ADMIN`). Route groups: `(user)` replaces `(guard)`, new `(admin)` added. Middleware pure function extended to handle 3 role × 3 prefix combinations. Admin is a super-user with no court — all data visible.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7, NextAuth v4, Tailwind CSS, Vitest

**Spec reference:** `docs/superpowers/specs/2026-04-14-phase2-three-roles-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `ADMIN` to `Role` enum |
| `prisma/seed.ts` | Modify | Assign manager a court; add admin seed user |
| `src/lib/auth-helpers.ts` | Modify | Add `isAdmin`, `isManagerOrAdmin` helpers |
| `tests/auth-helpers.test.ts` | Modify | Add ADMIN test cases |
| `src/lib/middleware-logic.ts` | Modify | Handle 3 roles; `/guard` → `/user` |
| `tests/middleware-logic.test.ts` | Modify | Update `/guard` refs; add ADMIN test cases |
| `src/app/page.tsx` | Modify | 3-way root redirect |
| `src/app/(user)/layout.tsx` | Create | Renamed from `(guard)/layout.tsx` |
| `src/app/(user)/user/page.tsx` | Create | Renamed from `(guard)/guard/page.tsx` |
| `src/app/(guard)/layout.tsx` | Delete | Replaced by `(user)` |
| `src/app/(guard)/guard/page.tsx` | Delete | Replaced by `(user)` |
| `src/app/(manager)/layout.tsx` | Modify | Remove courts/config nav; add periods nav |
| `src/app/(admin)/layout.tsx` | Create | Desktop RTL sidebar — full access |
| `src/app/(admin)/admin/page.tsx` | Create | Admin dashboard shell |

---

### Task 1: Add ADMIN to Role enum and migrate

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update the Role enum**

In `prisma/schema.prisma`, change:
```prisma
enum Role {
  GUARD
  MANAGER
}
```
to:
```prisma
enum Role {
  GUARD
  MANAGER
  ADMIN
}
```

- [ ] **Step 2: Run the migration**

```bash
pnpm db:migrate
```

When prompted for a migration name, enter: `add_admin_role`

Expected output: `✔ Generated Prisma Client`

- [ ] **Step 3: Verify the generated client has ADMIN**

```bash
grep -r "ADMIN" src/generated/prisma/enums.ts
```

Expected output: a line containing `ADMIN`

- [ ] **Step 4: Verify next-auth.d.ts requires no changes**

Open `src/types/next-auth.d.ts` and confirm `role` is typed as `Role` (imported from the Prisma generated client). Because `Role` is the Prisma enum, adding `ADMIN` to the enum automatically makes `Role.ADMIN` valid in session types. No edits needed.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/generated/
git commit -m "feat: add ADMIN to Role enum"
```

---

### Task 2: Auth helpers — isAdmin and isManagerOrAdmin

**Files:**
- Modify: `tests/auth-helpers.test.ts`
- Modify: `src/lib/auth-helpers.ts`

- [ ] **Step 1: Write the failing tests**

Replace the full content of `tests/auth-helpers.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { hasRole, isGuard, isManager, isAdmin, isManagerOrAdmin } from '@/lib/auth-helpers'
import type { Session } from 'next-auth'
import { Role } from '@/generated/prisma/client'

const makeSession = (role: Role): Session => ({
  user: { id: 'user-1', name: 'Test', email: 'test@test.com', role, primaryCourtId: null },
  expires: new Date(Date.now() + 86400_000).toISOString(),
})

describe('hasRole', () => {
  it('returns true when session role matches', () => {
    expect(hasRole(makeSession(Role.GUARD), Role.GUARD)).toBe(true)
    expect(hasRole(makeSession(Role.MANAGER), Role.MANAGER)).toBe(true)
    expect(hasRole(makeSession(Role.ADMIN), Role.ADMIN)).toBe(true)
  })

  it('returns false when roles do not match', () => {
    expect(hasRole(makeSession(Role.GUARD), Role.MANAGER)).toBe(false)
    expect(hasRole(makeSession(Role.ADMIN), Role.GUARD)).toBe(false)
  })

  it('returns false for null session', () => {
    expect(hasRole(null, Role.GUARD)).toBe(false)
  })
})

describe('isGuard', () => {
  it('returns true for GUARD session', () => {
    expect(isGuard(makeSession(Role.GUARD))).toBe(true)
  })

  it('returns false for MANAGER session', () => {
    expect(isGuard(makeSession(Role.MANAGER))).toBe(false)
  })

  it('returns false for ADMIN session', () => {
    expect(isGuard(makeSession(Role.ADMIN))).toBe(false)
  })
})

describe('isManager', () => {
  it('returns true for MANAGER session', () => {
    expect(isManager(makeSession(Role.MANAGER))).toBe(true)
  })

  it('returns false for GUARD session', () => {
    expect(isManager(makeSession(Role.GUARD))).toBe(false)
  })

  it('returns false for ADMIN session', () => {
    expect(isManager(makeSession(Role.ADMIN))).toBe(false)
  })
})

describe('isAdmin', () => {
  it('returns true for ADMIN session', () => {
    expect(isAdmin(makeSession(Role.ADMIN))).toBe(true)
  })

  it('returns false for MANAGER session', () => {
    expect(isAdmin(makeSession(Role.MANAGER))).toBe(false)
  })

  it('returns false for GUARD session', () => {
    expect(isAdmin(makeSession(Role.GUARD))).toBe(false)
  })

  it('returns false for null session', () => {
    expect(isAdmin(null)).toBe(false)
  })
})

describe('isManagerOrAdmin', () => {
  it('returns true for MANAGER session', () => {
    expect(isManagerOrAdmin(makeSession(Role.MANAGER))).toBe(true)
  })

  it('returns true for ADMIN session', () => {
    expect(isManagerOrAdmin(makeSession(Role.ADMIN))).toBe(true)
  })

  it('returns false for GUARD session', () => {
    expect(isManagerOrAdmin(makeSession(Role.GUARD))).toBe(false)
  })

  it('returns false for null session', () => {
    expect(isManagerOrAdmin(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests — expect failures for the two new helpers**

```bash
pnpm test:run tests/auth-helpers.test.ts
```

Expected: `isAdmin` and `isManagerOrAdmin` tests fail with "is not a function".

- [ ] **Step 3: Implement the two new helpers**

Replace the full content of `src/lib/auth-helpers.ts` with:

```ts
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import type { Session } from 'next-auth'
import { Role } from '@/generated/prisma/client'

export function hasRole(session: Session | null, role: Role): boolean {
  return session?.user?.role === role
}

export function isGuard(session: Session | null): boolean {
  return hasRole(session, Role.GUARD)
}

export function isManager(session: Session | null): boolean {
  return hasRole(session, Role.MANAGER)
}

export function isAdmin(session: Session | null): boolean {
  return hasRole(session, Role.ADMIN)
}

export function isManagerOrAdmin(session: Session | null): boolean {
  return isManager(session) || isAdmin(session)
}

/**
 * Use in server components / route handlers.
 * Redirects to /login if unauthenticated.
 * Redirects to /login if authenticated but wrong role.
 */
export async function requireSession(requiredRole?: Role): Promise<Session> {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')
  if (requiredRole && session.user.role !== requiredRole) redirect('/login')

  return session
}
```

- [ ] **Step 4: Run the tests — expect all pass**

```bash
pnpm test:run tests/auth-helpers.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-helpers.ts tests/auth-helpers.test.ts
git commit -m "feat: add isAdmin and isManagerOrAdmin helpers"
```

---

### Task 3: Middleware logic — 3 roles, /guard → /user

**Files:**
- Modify: `tests/middleware-logic.test.ts`
- Modify: `src/lib/middleware-logic.ts`

- [ ] **Step 1: Write the failing tests**

Replace the full content of `tests/middleware-logic.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { resolveRedirect } from '@/lib/middleware-logic'
import { Role } from '@/generated/prisma/client'

describe('resolveRedirect', () => {
  // Public routes
  it('returns null for /login (public route)', () => {
    expect(resolveRedirect('/login', null)).toBeNull()
  })

  it('returns null for /api/auth routes', () => {
    expect(resolveRedirect('/api/auth/session', null)).toBeNull()
    expect(resolveRedirect('/api/auth/callback/credentials', null)).toBeNull()
  })

  // Root redirect
  it('redirects unauthenticated user from / to /login', () => {
    expect(resolveRedirect('/', null)).toBe('/login')
  })

  it('redirects GUARD from / to /user', () => {
    expect(resolveRedirect('/', Role.GUARD)).toBe('/user')
  })

  it('redirects MANAGER from / to /manager', () => {
    expect(resolveRedirect('/', Role.MANAGER)).toBe('/manager')
  })

  it('redirects ADMIN from / to /admin', () => {
    expect(resolveRedirect('/', Role.ADMIN)).toBe('/admin')
  })

  // /user routes
  it('returns null (no redirect) when GUARD accesses /user routes', () => {
    expect(resolveRedirect('/user', Role.GUARD)).toBeNull()
    expect(resolveRedirect('/user/availability/abc', Role.GUARD)).toBeNull()
    expect(resolveRedirect('/user/schedule/xyz', Role.GUARD)).toBeNull()
  })

  it('redirects unauthenticated user from /user to /login', () => {
    expect(resolveRedirect('/user', null)).toBe('/login')
    expect(resolveRedirect('/user/availability/abc', null)).toBe('/login')
  })

  it('redirects MANAGER away from /user to /manager', () => {
    expect(resolveRedirect('/user', Role.MANAGER)).toBe('/manager')
    expect(resolveRedirect('/user/availability/abc', Role.MANAGER)).toBe('/manager')
  })

  it('redirects ADMIN away from /user to /admin', () => {
    expect(resolveRedirect('/user', Role.ADMIN)).toBe('/admin')
  })

  // /manager routes
  it('returns null (no redirect) when MANAGER accesses /manager routes', () => {
    expect(resolveRedirect('/manager', Role.MANAGER)).toBeNull()
    expect(resolveRedirect('/manager/periods/new', Role.MANAGER)).toBeNull()
    expect(resolveRedirect('/manager/guards', Role.MANAGER)).toBeNull()
  })

  it('redirects unauthenticated user from /manager to /login', () => {
    expect(resolveRedirect('/manager', null)).toBe('/login')
    expect(resolveRedirect('/manager/periods/new', null)).toBe('/login')
  })

  it('redirects GUARD away from /manager to /user', () => {
    expect(resolveRedirect('/manager', Role.GUARD)).toBe('/user')
    expect(resolveRedirect('/manager/periods/new', Role.GUARD)).toBe('/user')
  })

  it('redirects ADMIN away from /manager to /admin', () => {
    expect(resolveRedirect('/manager', Role.ADMIN)).toBe('/admin')
  })

  // /admin routes
  it('returns null (no redirect) when ADMIN accesses /admin routes', () => {
    expect(resolveRedirect('/admin', Role.ADMIN)).toBeNull()
    expect(resolveRedirect('/admin/courts', Role.ADMIN)).toBeNull()
    expect(resolveRedirect('/admin/managers', Role.ADMIN)).toBeNull()
    expect(resolveRedirect('/admin/guards', Role.ADMIN)).toBeNull()
    expect(resolveRedirect('/admin/config', Role.ADMIN)).toBeNull()
  })

  it('redirects unauthenticated user from /admin to /login', () => {
    expect(resolveRedirect('/admin', null)).toBe('/login')
    expect(resolveRedirect('/admin/config', null)).toBe('/login')
  })

  it('redirects GUARD away from /admin to /user', () => {
    expect(resolveRedirect('/admin', Role.GUARD)).toBe('/user')
  })

  it('redirects MANAGER away from /admin to /manager', () => {
    expect(resolveRedirect('/admin', Role.MANAGER)).toBe('/manager')
  })

  // Unrecognised paths pass through
  it('returns null for unrecognised paths (no redirect)', () => {
    expect(resolveRedirect('/some/unknown/path', Role.MANAGER)).toBeNull()
    expect(resolveRedirect('/favicon.ico', null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests — expect failures for ADMIN and /user cases**

```bash
pnpm test:run tests/middleware-logic.test.ts
```

Expected: ADMIN and `/user` cases fail; existing `/manager` cases pass.

- [ ] **Step 3: Rewrite middleware-logic.ts**

Replace the full content of `src/lib/middleware-logic.ts` with:

```ts
import { Role } from '@/generated/prisma/client'

/** Returns the home path for a given role. */
function homeFor(role: Role): string {
  if (role === Role.GUARD) return '/user'
  if (role === Role.MANAGER) return '/manager'
  return '/admin'
}

/**
 * Pure function — no Next.js dependency.
 * Returns the URL to redirect to, or null if the request should proceed.
 */
export function resolveRedirect(pathname: string, role: Role | null): string | null {
  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return null
  }

  // Root redirect
  if (pathname === '/') {
    if (!role) return '/login'
    return homeFor(role)
  }

  // User (guard) routes
  if (pathname.startsWith('/user')) {
    if (!role) return '/login'
    if (role !== Role.GUARD) return homeFor(role)
    return null
  }

  // Manager routes
  if (pathname.startsWith('/manager')) {
    if (!role) return '/login'
    if (role !== Role.MANAGER) return homeFor(role)
    return null
  }

  // Admin routes
  if (pathname.startsWith('/admin')) {
    if (!role) return '/login'
    if (role !== Role.ADMIN) return homeFor(role)
    return null
  }

  // All other paths: no redirect
  return null
}
```

- [ ] **Step 4: Run the tests — expect all pass**

```bash
pnpm test:run tests/middleware-logic.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/middleware-logic.ts tests/middleware-logic.test.ts
git commit -m "feat: extend middleware to handle 3 roles (GUARD/MANAGER/ADMIN)"
```

---

### Task 4: Root page — 3-way redirect

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update the root page**

Replace the full content of `src/app/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Role } from '@/generated/prisma/client'

export default async function RootPage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')
  if (session.user.role === Role.GUARD) redirect('/user')
  if (session.user.role === Role.MANAGER) redirect('/manager')
  redirect('/admin')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: 3-way root redirect for GUARD/MANAGER/ADMIN"
```

---

### Task 5: Rename (guard) route group to (user)

**Files:**
- Create: `src/app/(user)/layout.tsx`
- Create: `src/app/(user)/user/page.tsx`
- Delete: `src/app/(guard)/layout.tsx`
- Delete: `src/app/(guard)/guard/page.tsx`

- [ ] **Step 1: Create the new (user) layout**

Create `src/app/(user)/layout.tsx` with:

```tsx
import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/client'

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(Role.GUARD)

  const primaryCourt = session.user.primaryCourtId
    ? await prisma.court.findUnique({ where: { id: session.user.primaryCourtId } })
    : null

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="text-xs text-muted-foreground">
            {primaryCourt?.name ?? '—'}
          </div>
          <div>
            <p className="font-semibold text-sm">{session.user.name}</p>
            <p className="text-xs text-muted-foreground text-left">שמירה בתי משפט</p>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create the new user dashboard page**

Create `src/app/(user)/user/page.tsx` with:

```tsx
import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@/generated/prisma/client'
import { Card, CardContent } from '@/components/ui/card'

export default async function UserDashboardPage() {
  const session = await requireSession(Role.GUARD)

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">שלום, {session.user.name}</h1>

      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm text-center">
            אין תקופת תזמון פעילה כרגע.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Stage the old (guard) files for deletion and commit**

```bash
git add src/app/\(user\)/
git rm src/app/\(guard\)/guard/page.tsx src/app/\(guard\)/layout.tsx
git commit -m "feat: rename (guard) route group to (user), path /guard → /user"
```

---

### Task 6: Update manager layout nav

**Files:**
- Modify: `src/app/(manager)/layout.tsx`

- [ ] **Step 1: Update nav items and sidebar**

Replace the full content of `src/app/(manager)/layout.tsx` with:

```tsx
import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@/generated/prisma/client'
import Link from 'next/link'

const navItems = [
  { href: '/manager', label: 'לוח בקרה' },
  { href: '/manager/periods', label: 'תקופות' },
  { href: '/manager/guards', label: 'מאבטחים' },
]

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(Role.MANAGER)

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-56 border-e bg-card flex flex-col shrink-0">
        <div className="p-4 border-b">
          <p className="font-bold text-sm">שמירה בתי משפט</p>
          <p className="text-xs text-muted-foreground mt-0.5">{session.user.name}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(manager\)/layout.tsx
git commit -m "feat: update manager sidebar nav (remove courts/config, add periods)"
```

---

### Task 7: Admin layout and dashboard shell

**Files:**
- Create: `src/app/(admin)/layout.tsx`
- Create: `src/app/(admin)/admin/page.tsx`

- [ ] **Step 1: Create the admin layout**

Create `src/app/(admin)/layout.tsx` with:

```tsx
import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@/generated/prisma/client'
import Link from 'next/link'

const navItems = [
  { href: '/admin', label: 'לוח בקרה' },
  { href: '/admin/courts', label: 'בתי משפט' },
  { href: '/admin/managers', label: 'מנהלים' },
  { href: '/admin/guards', label: 'מאבטחים' },
  { href: '/admin/config', label: 'הגדרות מערכת' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(Role.ADMIN)

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-56 border-e bg-card flex flex-col shrink-0">
        <div className="p-4 border-b">
          <p className="font-bold text-sm">ניהול מערכת</p>
          <p className="text-xs text-muted-foreground mt-0.5">{session.user.name}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create the admin dashboard page**

Create `src/app/(admin)/admin/page.tsx` with:

```tsx
import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@/generated/prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdminDashboardPage() {
  await requireSession(Role.ADMIN)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">לוח בקרה — מנהל מערכת</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">בתי משפט</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">מנהלים</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">מאבטחים</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">
            ברוך הבא לממשק הניהול. בחר קטגוריה מהתפריט הצידי.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/
git commit -m "feat: add admin layout and dashboard shell"
```

---

### Task 8: Update seed — assign manager to court, add admin user

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Update the seed file**

Replace the manager upsert block and add the admin upsert. Find this block in `prisma/seed.ts`:

```ts
  // Manager
  const managerHash = await bcrypt.hash('manager123', 12)
  await prisma.user.upsert({
    where: { email: 'manager@court.gov.il' },
    update: {},
    create: {
      email: 'manager@court.gov.il',
      passwordHash: managerHash,
      name: 'מנהל מערכת',
      role: Role.MANAGER,
    },
  })
```

Replace it with:

```ts
  // Manager — assigned to courtA
  const managerHash = await bcrypt.hash('manager123', 12)
  await prisma.user.upsert({
    where: { email: 'manager@court.gov.il' },
    update: { primaryCourtId: courtA.id },
    create: {
      email: 'manager@court.gov.il',
      passwordHash: managerHash,
      name: 'מנהל מערכת',
      role: Role.MANAGER,
      primaryCourtId: courtA.id,
    },
  })

  // Admin — no court (full access)
  const adminHash = await bcrypt.hash('admin123', 12)
  await prisma.user.upsert({
    where: { email: 'admin@court.gov.il' },
    update: {},
    create: {
      email: 'admin@court.gov.il',
      passwordHash: adminHash,
      name: 'מנהל ראשי',
      role: Role.ADMIN,
    },
  })
```

Also update the console.log at the end to include admin credentials. Find:

```ts
  console.log('Manager login: manager@court.gov.il / manager123')
  console.log('Guard login:   cohen@court.gov.il / guard123')
```

Replace with:

```ts
  console.log('Admin login:   admin@court.gov.il / admin123')
  console.log('Manager login: manager@court.gov.il / manager123')
  console.log('Guard login:   cohen@court.gov.il / guard123')
```

- [ ] **Step 2: Run the seed**

```bash
pnpm db:seed
```

Expected output:
```
Seeding database...
Seed complete.
Admin login:   admin@court.gov.il / admin123
Manager login: manager@court.gov.il / manager123
Guard login:   cohen@court.gov.il / guard123
```

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: assign manager to court in seed, add admin seed user"
```

---

### Task 9: Run all tests and verify

- [ ] **Step 1: Run the full test suite**

```bash
pnpm test:run
```

Expected: all tests pass.

- [ ] **Step 2: Build the project to check for TypeScript errors**

```bash
pnpm build
```

Expected: build succeeds with no type errors.
