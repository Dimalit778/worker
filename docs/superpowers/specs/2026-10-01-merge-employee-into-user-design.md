# Merge `Employee` into `User` — Design

## Decisions
- Every employee is created by a manager together with a login (email + password). No employee exists without a `User`.
- Login stays email + password.
- Admin is a `User` with no facility and no shift role. Facility managers are regular employees with a `UserFacilityRole`.

## Approach
Merge the `Employee` model into `User` (single table). Child tables keep their `employeeId` column names but their FK now targets `User.id`, to minimise code churn.

## 1. Schema
`User` gains: `firstName`, `lastName`, `displayName`, `phone?`, `shiftRoleId?`, `facilityId?`, `isActive`, `isReligious`, plus the Employee relations (availability submissions, assignments, stats, warnings) and the `[shiftRoleId, facilityId]` composite FK to `ShiftRole`.
Removed: `Employee` model, `User.employeeId`.
`firstName`, `lastName`, `displayName` are required (users without an Employee, e.g. admin, are back-filled from the email local part).
`facilityId` and `shiftRoleId` are nullable (admin). Manual migration SQL adds:
`CHECK (systemRole = 'ADMIN' OR (facilityId IS NOT NULL AND shiftRoleId IS NOT NULL))`.
The composite FK is ignored by Postgres when either column is NULL (MATCH SIMPLE).

## 2. Migration
Pre-check (read-only): count `Employee` rows with no linked `User`. Must be 0; otherwise stop and decide.
Single migration, in order:
1. Add new columns to `User`; copy values from `Employee` via `User.employeeId`.
2. Re-point every child FK from `Employee.id` to `User.id` (`UPDATE child SET employeeId = user.id` joined on `User.employeeId`, then swap FK constraints).
3. Drop `Employee` and `User.employeeId`.
Builds on the uncommitted `20260930120000_*` and `20261001130000_*` migrations, which should be finished/committed first.

## 3. Code
- `src/lib/auth/auth.ts`, `src/lib/db/auth-helpers.ts`, `src/types/next-auth.d.ts`: drop the employee join; `employeeId` = `user.id` when `facilityId` is set, else `null`.
- `src/features/employess/actions.ts`: creating an employee creates one `User`.
- Employee queries (`schedules`, `scheduling-engine`, `periods`, `dashboard`, `availability`, `admin`): `prisma.employee` -> `prisma.user` filtered by `facilityId != null` so admin never appears in lists or the engine.
- Seeds (`prisma/seed*.ts`) and `tests/` updated.

## 4. Environment
Migration is applied to the DB pointed to by the local `DATABASE_URL` only. Any other environment (e.g. Neon/production) needs a separate `prisma migrate deploy`. State exactly where it ran when done.

## 5. Validation
`prisma generate`, typecheck, lint, unit tests (`src/features/scheduling-engine/tests`), `tests/scheduling-postgres.test.ts`, and a manual login as admin and as an employee.
