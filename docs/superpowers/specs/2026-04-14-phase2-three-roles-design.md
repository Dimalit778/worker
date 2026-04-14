# Phase 2 — Three-Role Routing Design

**Date:** 2026-04-14
**Status:** Approved for implementation planning
**Builds on:** `docs/superpowers/specs/2026-04-13-court-guard-scheduler-design.md`

---

## 1. Goal

Extend the Phase 1 foundation (2 roles: GUARD, MANAGER) to 3 roles:

| Role    | Route prefix | Scope                              |
|---------|--------------|------------------------------------|
| GUARD   | `/user`      | Own availability + own schedule    |
| MANAGER | `/manager`   | One assigned court + that court's guards |
| ADMIN   | `/admin`     | All courts, all guards, all schedules |

---

## 2. Schema Change

**Single migration:** Add `ADMIN` to the `Role` enum in `prisma/schema.prisma`.

```prisma
enum Role {
  GUARD
  MANAGER
  ADMIN   // new
}
```

No new columns. The existing `primaryCourtId` on `User` carries role-specific meaning:

| Role    | `primaryCourtId`    | Meaning                         |
|---------|---------------------|---------------------------------|
| GUARD   | Court ID or null    | Guard's assigned court          |
| MANAGER | Court ID (required) | The court this manager oversees |
| ADMIN   | Always null         | No court — full access          |

---

## 3. Route Structure

```
src/app/
├── (auth)/
│   └── login/                        (unchanged)
├── (user)/                           ← renamed from (guard)
│   ├── layout.tsx                    (mobile RTL, court header)
│   └── user/
│       └── page.tsx                  (guard dashboard shell)
├── (manager)/
│   ├── layout.tsx                    (desktop sidebar, scoped to primaryCourtId)
│   └── manager/
│       └── page.tsx                  (manager dashboard — their court only)
└── (admin)/
    ├── layout.tsx                    (desktop sidebar, full access)
    └── admin/
        └── page.tsx                  (admin dashboard — all courts)
```

---

## 4. Root Redirect

```
/  →  no session  →  /login
/  →  GUARD       →  /user
/  →  MANAGER     →  /manager
/  →  ADMIN       →  /admin
```

---

## 5. Middleware (middleware-logic.ts)

Pure function `resolveRedirect(pathname, role)` extended to 3 roles:

| Visiting            | Role is GUARD | Role is MANAGER | Role is ADMIN | No session |
|---------------------|---------------|-----------------|---------------|------------|
| `/user/*`           | allow         | → `/manager`    | → `/admin`    | → `/login` |
| `/manager/*`        | → `/user`     | allow           | → `/admin`    | → `/login` |
| `/admin/*`          | → `/user`     | → `/manager`    | allow         | → `/login` |
| `/login`, `/api/auth` | allow       | allow           | allow         | allow      |
| `/` (root)          | → `/user`     | → `/manager`    | → `/admin`    | → `/login` |

---

## 6. Auth Helpers (auth-helpers.ts)

Add two helpers:

```ts
export function isAdmin(session: Session | null): boolean
export function isManagerOrAdmin(session: Session | null): boolean
```

`requireSession(role?)` unchanged — accepts `Role.ADMIN` as the required role argument.

---

## 7. Layout Shells

### (user) layout — mobile RTL (renamed from guard)
- Sticky header: guard name (right) + court name (left)
- No sidebar
- `requireSession(Role.GUARD)`

### (manager) layout — desktop RTL sidebar
- Sidebar nav:
  - `לוח בקרה` → `/manager`
  - `תקופות` → `/manager/periods`
  - `מאבטחים` → `/manager/guards`
- `requireSession(Role.MANAGER)`
- Court scoping (filtering queries by `primaryCourtId`) is enforced in Phase 3 service calls, not in the layout itself

### (admin) layout — desktop RTL sidebar
- Sidebar nav:
  - `לוח בקרה` → `/admin`
  - `בתי משפט` → `/admin/courts`
  - `מנהלים` → `/admin/managers`
  - `מאבטחים` → `/admin/guards`
  - `הגדרות מערכת` → `/admin/config`
- `requireSession(Role.ADMIN)`
- No court scoping — all data visible

---

## 8. Seed Data

Add one admin user to `prisma/seed.ts`:

```
email: admin@court.gov.il
role: ADMIN
primaryCourtId: null
```

Existing seed manager and guard users remain unchanged.

---

## 9. Account Creation Rules

| Actor   | Can create          | Court scoping                          |
|---------|---------------------|----------------------------------------|
| ADMIN   | Guards + Managers   | Can assign any court to any user       |
| MANAGER | Guards only         | Can only assign guards to their own court |
| GUARD   | —                   | Cannot create accounts                 |

UI for account creation is out of scope for this phase (Phase 2 is routing + shells only). The rules above inform Phase 3 design.

---

## 10. What This Phase Does NOT Include

- Any data-fetching or real content in dashboard pages (placeholders only)
- Account creation UI
- Period management UI
- Scheduling engine integration
- Any API routes beyond auth

Phase 2 delivers: working 3-role auth, correct route protection, and three layout shells with correct nav items.

---

## 11. Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `ADMIN` to `Role` enum |
| `prisma/seed.ts` | Add admin seed user |
| `src/lib/middleware-logic.ts` | Handle 3 roles |
| `tests/middleware-logic.test.ts` | Add ADMIN test cases |
| `src/lib/auth-helpers.ts` | Add `isAdmin`, `isManagerOrAdmin` |
| `tests/auth-helpers.test.ts` | Add ADMIN test cases |
| `src/types/next-auth.d.ts` | Role type already covers ADMIN via Prisma enum — verify no change needed |
| `src/app/page.tsx` | 3-way redirect |
| `src/app/(user)/layout.tsx` | Renamed from `(guard)/layout.tsx` |
| `src/app/(user)/user/page.tsx` | Renamed from `(guard)/guard/page.tsx` |
| `src/app/(manager)/layout.tsx` | Update nav items |
| `src/app/(admin)/layout.tsx` | New file |
| `src/app/(admin)/admin/page.tsx` | New file — dashboard shell |
