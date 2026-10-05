# Merge `Employee` into `User` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `Employee` + `User` pair with a single `User` model that carries the employee fields.

**Architecture:** `User` gains the employee columns; `facilityId`/`shiftRoleId` are nullable (admin has neither). Child tables keep their `employeeId` column and their Prisma relation field name `employee`, but the relation now targets `User`, so nested filters like `employee: { facilityId, isActive: true }` keep working unchanged. Only `prisma.employee.*` calls and `user.employee` accesses change.

**Tech Stack:** Next.js App Router, TypeScript, Prisma + PostgreSQL, next-auth, vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-01-merge-employee-into-user-design.md`

## Global Constraints

- Login stays email + password. No new login field.
- Every employee is a `User`; admin is a `User` with `facilityId = NULL` and `shiftRoleId = NULL`.
- `firstName`, `lastName`, `displayName` are **required** on `User` (admin rows are back-filled from the email local part). This refines the spec.
- Manual SQL CHECK: `systemRole = 'ADMIN' OR (facilityId IS NOT NULL AND shiftRoleId IS NOT NULL)`.
- Keep `session.user.employeeId` in the session shape; its value becomes `user.id` when the user has a `facilityId`, else `null`.
- Keep Hebrew UI strings untouched. No new libraries. Keep Prisma server-side only.
- Do not run `prisma migrate reset`. Never touch a non-local DB without the user's explicit OK.
- Only stage files listed in each task. The working tree already has unrelated uncommitted changes.
- Commit only if the user asked for commits in this session.

---

### Task 0: Pre-flight

**Files:** none modified.

- [ ] **Step 1: Ask the user which DB `prisma migrate dev` may run against**

Ask: "The migration will run on the DB in `.env.local` `DATABASE_URL` (do you confirm it is a local/dev DB, not production)?" Do not read `.env*`. Proceed only on a clear yes.

- [ ] **Step 2: Confirm the two earlier uncommitted migrations are applied**

Run: `pnpm exec prisma migrate status`
Expected: `20260930120000_replace_capability_with_shift_role_rank` and `20261001130000_rename_employee_shift_role` appear as applied (or pending, which `migrate dev` will apply). If the status reports drift or failure, stop and tell the user.

- [ ] **Step 3: Capture a baseline of existing type errors**

Run: `pnpm typecheck 2>&1 | tail -20`
Expected: note the output. Any error that exists now is out of scope; only errors introduced by this plan must be fixed.

- [ ] **Step 4: Pre-check data (read-only)**

Create `/private/tmp/claude-501/-Users-dimalitvinov-Mac-Dev-Projects-worker/7984f396-f6b1-4610-8c63-5d6cc975b5f2/scratchpad/precheck.ts`:

```ts
import { prisma } from '@/lib/db/client';

async function main() {
  const orphans = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "Employee" e
    WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."employeeId" = e.id)`;
  const counts = await prisma.$queryRaw<{ t: string; n: bigint }[]>`
    SELECT 'User' AS t, count(*) AS n FROM "User"
    UNION ALL SELECT 'Employee', count(*) FROM "Employee"
    UNION ALL SELECT 'ShiftAssignment', count(*) FROM "ShiftAssignment"
    UNION ALL SELECT 'AvailabilitySubmission', count(*) FROM "AvailabilitySubmission"
    UNION ALL SELECT 'ScheduleWarning', count(*) FROM "ScheduleWarning"
    UNION ALL SELECT 'EmployeeScheduleStats', count(*) FROM "EmployeeScheduleStats"`;
  console.log('orphan employees:', String(orphans[0].n));
  console.log(counts.map((c) => `${c.t}=${c.n}`).join(' '));
  await prisma.$disconnect();
}
main();
```

Run: `pnpm exec tsx --env-file=.env.local --tsconfig tsconfig.json /private/tmp/claude-501/-Users-dimalitvinov-Mac-Dev-Projects-worker/7984f396-f6b1-4610-8c63-5d6cc975b5f2/scratchpad/precheck.ts`
Expected: `orphan employees: 0`. Save the printed counts. If orphans > 0, STOP and ask the user what to do with them.
(If the `@/` alias does not resolve under tsx, import `PrismaClient` from `../../../../../../Mac/Dev/Projects/worker/src/generated/prisma/client` the same way `prisma/seed.ts` does — copy its client setup.)

---

### Task 1: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma` (comments at lines 1 and 40-42; `User` at 141-166; `Facility.employees` at 222; delete `Employee` at 241-276; `ShiftRole.primaryEmployees` at 290; relations at 346, 489, 531, 560)
- Create: `prisma/migrations/20261001140000_merge_employee_into_user/migration.sql`

**Interfaces:**
- Produces: Prisma `User` with fields `firstName, lastName, displayName, phone?, isActive, isReligious, shiftRoleId?, facilityId?, facility?, shiftRole?, availabilitySubmissions, assignments, employeeStats, warnings`. `Facility.employees: User[]`, `ShiftRole.primaryEmployees: User[]`. Child relation fields named `employee` now have type `User`. `Employee` model and `User.employeeId` / `User.employee` no longer exist.

- [ ] **Step 1: Edit the `User` model**

Replace the `employeeId` / `employee` lines (148-149) with the block below, add the indexes/unique, keeping every other existing line:

```prisma
  firstName   String
  lastName    String
  displayName String
  phone       String?
  isActive    Boolean @default(true)
  isReligious Boolean @default(false)

  // Admin has neither. Employees and managers always have both (CHECK in migration).
  shiftRoleId String?
  facilityId  String?
  facility    Facility?  @relation(fields: [facilityId], references: [id], onDelete: Restrict)
  shiftRole   ShiftRole? @relation("EmployeeShiftRole", fields: [shiftRoleId, facilityId], references: [id, facilityId], onDelete: Restrict)

  availabilitySubmissions AvailabilitySubmission[]
  assignments             ShiftAssignment[]
  employeeStats           EmployeeScheduleStats[]
  warnings                ScheduleWarning[]
```

At the bottom of the model, next to `@@index([systemRole])`, add:

```prisma
  @@unique([id, facilityId])
  @@index([facilityId])
  @@index([facilityId, isActive])
  @@index([shiftRoleId])
  @@index([shiftRoleId, facilityId])
```

- [ ] **Step 2: Re-point the other models**

- Line 222: `employees            Employee[]` -> `employees            User[]`
- Line 290: `primaryEmployees     Employee[]            @relation("EmployeeShiftRole")` -> `primaryEmployees     User[]                @relation("EmployeeShiftRole")`
- Lines 346, 489, 531, 560: change the type `Employee` / `Employee?` to `User` / `User?`, keep field names, `fields`, `references`, `onDelete` exactly as they are. E.g. line 489 becomes:
  `employee User @relation(fields: [employeeId, facilityId], references: [id, facilityId], onDelete: Cascade)`
- Delete the whole `Employee` model and its `///` doc comment (lines 241-276).
- Comments: line 1 `Employee ->` -> `User ->`; lines 40-42 replace "Employee identity comes from User.employee" with "Employee fields live on User" and "Employee.shiftRole.rank" with "User.shiftRole.rank".

- [ ] **Step 3: Validate the schema**

Run: `pnpm exec prisma validate`
Expected: `The schema ... is valid`.
If Prisma rejects the `ShiftAssignment` composite relation to `User(id, facilityId)` because `User.facilityId` is optional, fallback: change `ShiftAssignment.employee` to `fields: [employeeId], references: [id]` (single column, keep `onDelete: Cascade`), and in the migration SQL below skip the composite FK, adding `FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE` named `ShiftAssignment_employeeId_fkey`, and drop `@@index([employeeId, facilityId])` only if Prisma asks. Tell the user about the fallback.

- [ ] **Step 4: Write the migration SQL**

Create `prisma/migrations/20261001140000_merge_employee_into_user/migration.sql`:

```sql
-- 1. New columns on User (nullable first so existing rows are valid)
ALTER TABLE "User"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "shiftRoleId" TEXT,
  ADD COLUMN "facilityId" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "isReligious" BOOLEAN NOT NULL DEFAULT false;

-- 2. Abort if any Employee has no User
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Employee" e
    WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."employeeId" = e.id)
  ) THEN
    RAISE EXCEPTION 'Employee rows without a User exist; aborting merge';
  END IF;
END $$;

-- 3. Copy employee data onto User
UPDATE "User" u SET
  "firstName" = e."firstName",
  "lastName" = e."lastName",
  "displayName" = e."displayName",
  "phone" = e."phone",
  "shiftRoleId" = e."shiftRoleId",
  "facilityId" = e."facilityId",
  "isActive" = e."isActive",
  "isReligious" = e."isReligious"
FROM "Employee" e
WHERE u."employeeId" = e.id;

-- Users that never had an Employee (e.g. admin)
UPDATE "User" SET
  "firstName" = split_part("email", '@', 1),
  "lastName" = '',
  "displayName" = split_part("email", '@', 1)
WHERE "employeeId" IS NULL;

ALTER TABLE "User"
  ALTER COLUMN "firstName" SET NOT NULL,
  ALTER COLUMN "lastName" SET NOT NULL,
  ALTER COLUMN "displayName" SET NOT NULL;

-- 4. Drop old FKs that point at Employee
ALTER TABLE "AvailabilitySubmission" DROP CONSTRAINT "AvailabilitySubmission_employeeId_fkey";
ALTER TABLE "ShiftAssignment" DROP CONSTRAINT "ShiftAssignment_employeeId_facilityId_fkey";
ALTER TABLE "ScheduleWarning" DROP CONSTRAINT "ScheduleWarning_employeeId_fkey";
ALTER TABLE "EmployeeScheduleStats" DROP CONSTRAINT "EmployeeScheduleStats_employeeId_fkey";
ALTER TABLE "User" DROP CONSTRAINT "User_employeeId_fkey";

-- 5. Re-point child rows from Employee.id to User.id
UPDATE "AvailabilitySubmission" c SET "employeeId" = u."id" FROM "User" u WHERE u."employeeId" = c."employeeId";
UPDATE "ShiftAssignment" c SET "employeeId" = u."id" FROM "User" u WHERE u."employeeId" = c."employeeId";
UPDATE "ScheduleWarning" c SET "employeeId" = u."id" FROM "User" u WHERE u."employeeId" = c."employeeId";
UPDATE "EmployeeScheduleStats" c SET "employeeId" = u."id" FROM "User" u WHERE u."employeeId" = c."employeeId";

-- 6. Drop Employee and the link column
ALTER TABLE "User" DROP COLUMN "employeeId";
DROP TABLE "Employee";

-- 7. Indexes and constraints on User
CREATE UNIQUE INDEX "User_id_facilityId_key" ON "User"("id", "facilityId");
CREATE INDEX "User_facilityId_idx" ON "User"("facilityId");
CREATE INDEX "User_facilityId_isActive_idx" ON "User"("facilityId", "isActive");
CREATE INDEX "User_shiftRoleId_idx" ON "User"("shiftRoleId");
CREATE INDEX "User_shiftRoleId_facilityId_idx" ON "User"("shiftRoleId", "facilityId");

ALTER TABLE "User" ADD CONSTRAINT "User_facilityId_fkey"
  FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_shiftRoleId_facilityId_fkey"
  FOREIGN KEY ("shiftRoleId", "facilityId") REFERENCES "ShiftRole"("id", "facilityId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma cannot express this; admin is the only user without facility/role.
ALTER TABLE "User" ADD CONSTRAINT "User_facility_role_required_chk"
  CHECK ("systemRole" = 'ADMIN' OR ("facilityId" IS NOT NULL AND "shiftRoleId" IS NOT NULL));

-- 8. New FKs on child tables
ALTER TABLE "AvailabilitySubmission" ADD CONSTRAINT "AvailabilitySubmission_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_employeeId_facilityId_fkey"
  FOREIGN KEY ("employeeId", "facilityId") REFERENCES "User"("id", "facilityId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleWarning" ADD CONSTRAINT "ScheduleWarning_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeScheduleStats" ADD CONSTRAINT "EmployeeScheduleStats_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 5: Apply to the confirmed DB**

Run: `pnpm exec prisma migrate dev`
Expected: applies `20261001140000_merge_employee_into_user` and regenerates the client with no "drift" message and no additional generated migration. If Prisma wants to create another migration (name/index differences), run `pnpm exec prisma migrate dev --create-only --name drift_fix`, inspect the SQL, and fold any index/constraint-name differences back into the migration above only if the DB is still disposable; otherwise keep it as a follow-up migration and tell the user.
If a `DROP CONSTRAINT` fails with "does not exist", read the real name with `pnpm exec prisma db execute --stdin <<< "SELECT conname FROM pg_constraint WHERE conrelid = '\"ShiftAssignment\"'::regclass;"`, fix the SQL, and re-run (a failed migration is rolled back; if Prisma marks it failed, `pnpm exec prisma migrate resolve --rolled-back 20261001140000_merge_employee_into_user` first).

- [ ] **Step 6: Verify data preserved**

Re-run the Task 0 step 4 script, but remove the `Employee` and orphan queries (the table no longer exists). Expected: `User`, `ShiftAssignment`, `AvailabilitySubmission`, `ScheduleWarning`, `EmployeeScheduleStats` counts equal the saved pre-migration counts (User count unchanged; it was already one User per Employee plus admin).

- [ ] **Step 7: Stage**

`git add prisma/schema.prisma prisma/migrations/20261001140000_merge_employee_into_user` (the regenerated `src/generated/prisma/*` is already tracked; stage it only if the user asked for commits, and note it contains earlier unrelated regeneration).

---

### Task 2: Auth and session

**Files:**
- Modify: `src/lib/auth/auth.ts:30-66`
- Modify: `src/lib/db/auth-helpers.ts:30-64`
- Modify: `src/app/(employee)/layout.tsx:15-33`
- Test: `tests/auth-helpers.test.ts` (unchanged; must still pass)

**Interfaces:**
- Produces: `session.user.employeeId` equals `user.id` when `user.facilityId` is set, else `null`. `session.user.facilityId` unchanged semantics.

- [ ] **Step 1: `src/lib/auth/auth.ts`**

In the `findFirst` include, delete the line `employee: true,`. Replace the block from `const managerRole` to the returned object with:

```ts
        const managerRole = user.facilityRoles[0];
        const portal =
          user.systemRole === SystemRole.ADMIN
            ? PortalRole.ADMIN
            : managerRole
              ? PortalRole.MANAGER
              : user.facilityId
                ? PortalRole.EMPLOYEE
                : null;
        if (!portal) return null;
        if (portal === PortalRole.EMPLOYEE && !user.isActive) return null;
        if (portal === PortalRole.MANAGER && !managerRole) return null;

        return {
          id: user.id,
          email: user.email,
          fullName: user.displayName,
          phone: user.phone,
          systemRole: user.systemRole,
          portal,
          facilityId: managerRole?.facilityId ?? user.facilityId,
          employeeId: user.facilityId ? user.id : null,
          mustChangePassword: user.mustChangePassword,
        };
```

- [ ] **Step 2: `src/lib/db/auth-helpers.ts`**

`portalFor` becomes:

```ts
function portalFor(user: {
  systemRole: SystemRole;
  facilityRoles: { role: FacilityRole }[];
  facilityId: string | null;
}): PortalRoleValue | null {
  if (user.systemRole === SystemRole.ADMIN) return PortalRole.ADMIN;
  if (user.facilityRoles.some((membership) => membership.role === FacilityRole.MANAGER)) return PortalRole.MANAGER;
  if (user.facilityId) return PortalRole.EMPLOYEE;
  return null;
}
```

In `requireSession`: delete `employee: true,` from `include`; then

```ts
  const facilityId = user.facilityRoles[0]?.facilityId ?? user.facilityId;
  if (portal === PortalRole.MANAGER && !facilityId) redirect('/login');
  if (portal === PortalRole.EMPLOYEE && !user.isActive) redirect('/login');
  session.user = {
    ...session.user,
    systemRole: user.systemRole,
    portal,
    facilityId,
    employeeId: user.facilityId ? user.id : null,
    mustChangePassword: user.mustChangePassword,
  };
```

- [ ] **Step 3: `src/app/(employee)/layout.tsx`**

Replace the `findUnique` block and the `employeeId` uses:

```ts
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          facilityId: true,
          shiftRole: { select: { code: true } },
        },
      });
      if (!user?.facilityId) return false;
      if (user.shiftRole?.code === 1) return false;
```

and in the `periodId_employeeId` lookup use `employeeId: session.user.id`.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck 2>&1 | grep -E "auth\.ts|auth-helpers|\(employee\)/layout"`
Expected: no output. Run: `pnpm exec vitest run tests/auth-helpers.test.ts` — Expected: PASS.

---

### Task 3: Manager employees feature

**Files:**
- Modify: `src/features/employess/actions.ts` (all `prisma.employee` / `tx.employee` uses)

**Interfaces:**
- Consumes: Task 1 `User` model.
- Produces: unchanged exported signatures and DTOs (`EmployeesPageData`, `EmployeeDetailData`, `EmployeeSubmissionsData`). `EmployeeDetailData.employee.user` stays populated from the same row (never `null` now).

- [ ] **Step 1: `createEmployee` transaction body**

Replace the `tx.employee.create` + `tx.user.create` pair (lines ~68-90) with:

```ts
      await tx.user.create({
        data: {
          email,
          passwordHash,
          systemRole: SystemRole.USER,
          mustChangePassword: true,
          firstName,
          lastName,
          displayName,
          phone,
          shiftRoleId: positionId,
          facilityId,
          isActive: true,
          isReligious,
        },
      });
```

(Keep the preceding `existingUser` check.)

- [ ] **Step 2: `updateEmployee` / `deleteEmployee`**

- `prisma.employee.findFirst(` -> `prisma.user.findFirst(` (both functions; `where` unchanged).
- `prisma.employee.update(` -> `prisma.user.update(`, `tx.employee.update(` -> `tx.user.update(` (data unchanged).

- [ ] **Step 3: `getEmployeesPageData`**

Change the first query to:

```ts
    prisma.user.findMany({
      where: { facilityId: targetCourtId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        displayName: true,
        isReligious: true,
        isActive: true,
        shiftRole: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [{ shiftRole: { code: 'asc' } }, { displayName: 'asc' }],
    }),
```

and the mapping to:

```ts
    employees: employees.map((employee) => ({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.phone,
      email: employee.email,
      displayName: employee.displayName,
      isReligious: employee.isReligious,
      isActive: employee.isActive,
      position: {
        id: employee.shiftRole!.id,
        name: employee.shiftRole!.name,
        code: employee.shiftRole!.code,
      },
    })),
```

(`!` is safe: rows are filtered by `facilityId`, and the CHECK guarantees `shiftRole` for them.)

- [ ] **Step 4: `getManagerEmployeeDetail`**

Query: `prisma.employee.findFirst` -> `prisma.user.findFirst`; in `select` replace the nested `user: { select: {...} }` with top-level `email: true, mustChangePassword: true,` (keep `createdAt`, `updatedAt`). Replace `if (!employee) return { error: 'עובד לא נמצא' };` with:

```ts
  if (!employee || !employee.facility || !employee.shiftRole) return { error: 'עובד לא נמצא' };
```

In the returned object: `email: employee.email,` and

```ts
      user: {
        id: employee.id,
        email: employee.email,
        mustChangePassword: employee.mustChangePassword,
        createdAt: employee.createdAt.toISOString(),
        updatedAt: employee.updatedAt.toISOString(),
      },
```

(`position: employee.shiftRole` and the `court` block stay as they are.)

- [ ] **Step 5: `getManagerEmployeeSubmissions`**

`prisma.employee.findFirst` -> `prisma.user.findFirst`; replace `if (!employee) return ...` with `if (!employee || !employee.shiftRole) return { error: 'עובד לא נמצא' };`.

- [ ] **Step 6: Verify**

Run: `pnpm typecheck 2>&1 | grep "employess/"`
Expected: no output.

---

### Task 4: Admin courts/employees actions

**Files:**
- Modify: `src/features/admin/actions.ts` (lines ~76-125, ~225-265, ~327-352, ~384-440, ~468-485)

**Interfaces:**
- Consumes: Task 1 `User` model. `AdminEmployeeItem` in `src/features/admin/types.ts` unchanged (it still has `email`, `systemRole`, `position`).

- [ ] **Step 1: Court listing (`facilities.select.employees`)**

Replace the nested `user: { select: { email: true, systemRole: true } }` with top-level `email: true, systemRole: true,`. In the mapping replace the two lines:

```ts
          email: employee.user?.email ?? '',
          ...
          systemRole: employee.user?.systemRole ?? null,
```
with
```ts
          email: employee.email,
          ...
          systemRole: employee.systemRole,
```
and `position: employee.shiftRole,` -> `position: employee.shiftRole!,`.

- [ ] **Step 2: `deleteAdminCourt`**

Change the court select to `employees: { select: { id: true } },`, then replace the id computations and the two deletes:

```ts
      const userIds = court.employees.map((employee) => employee.id);
```
Delete the `employeeIds` const. Keep the `externalScheduleRefs` check and `tx.roster.deleteMany`. Keep:

```ts
      if (userIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }
```
and delete the whole `if (employeeIds.length > 0) { await tx.employee.deleteMany(...) }` block.

- [ ] **Step 3: `createAdminEmployee`**

Replace `tx.employee.create` + `tx.user.create` with:

```ts
      await tx.user.create({
        data: {
          email,
          passwordHash,
          systemRole: SystemRole.USER,
          mustChangePassword: true,
          firstName,
          lastName,
          displayName,
          phone,
          shiftRoleId: positionId,
          facilityId,
          isActive: params.isActive,
          isReligious: params.isReligious,
        },
      });
```

- [ ] **Step 4: `updateAdminEmployee`**

Inside the transaction:

```ts
      const employee = await tx.user.findUnique({
        where: { id: employeeId },
        select: { id: true, facilityId: true },
      });

      if (!employee || !employee.facilityId) {
        throw new Error('EMPLOYEE_NOT_FOUND');
      }

      const position = await tx.shiftRole.findFirst({
        where: {
          id: positionId,
          facilityId: employee.facilityId,
        },
        select: { id: true },
      });

      if (!position) {
        throw new Error('POSITION_NOT_IN_COURT');
      }

      await tx.user.update({
        where: { id: employeeId },
        data: {
          email,
          firstName,
          lastName,
          displayName,
          phone,
          shiftRoleId: positionId,
          isActive: params.isActive,
          isReligious: params.isReligious,
        },
      });
```

Delete the old `if (employee.user) {...} else {...}` block (every employee is already a `User`).

- [ ] **Step 5: `deleteAdminEmployee`**

```ts
      const employee = await tx.user.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!employee) {
        throw new Error('EMPLOYEE_NOT_FOUND');
      }

      await tx.user.update({ where: { id }, data: { isActive: false } });
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck 2>&1 | grep "features/admin"`
Expected: no output. If `admin-courts-client.tsx` reports a type error about `systemRole` being non-null, relax nothing in the UI; widen nothing — just report it.

---

### Task 5: Read queries (schedules, dashboard, periods, availability)

**Files:**
- Modify: `src/features/schedules/assignments/queries.ts:58,88,112`
- Modify: `src/features/schedules/generation/queries.ts:11,33`
- Modify: `src/features/schedules/change-log/queries.ts:30-48`
- Modify: `src/features/dashboard/queries.ts:68,69,150,190` (+ `.shiftRole.name` use near line 85)
- Modify: `src/features/periods/actions.ts:41`
- Modify: `src/features/periods/process-windows.ts:34-43`
- Modify: `src/features/availability/actions.ts:30`

- [ ] **Step 1: One-line renames**

- `src/features/schedules/assignments/queries.ts:58` `prisma.employee.findMany(` -> `prisma.user.findMany(`; in its mapper (lines ~72-80) use `e.shiftRole!.id`, `e.shiftRole!.name`, `e.shiftRole!.code`.
- `src/features/periods/actions.ts:41` `prisma.employee.count(` -> `prisma.user.count(`.
- `src/features/availability/actions.ts:30` `tx.employee.findFirst(` -> `tx.user.findFirst(`.
- `src/features/dashboard/queries.ts` lines 68, 69, 150, 190: `prisma.employee.count(`/`findMany(` -> `prisma.user.count(`/`findMany(`; the mapper that reads `employee.shiftRole.name` -> `employee.shiftRole!.name`.
- `src/features/schedules/generation/queries.ts:11` `tx.employee.findMany(` -> `tx.user.findMany(`; line 33 becomes
  `employees: employees.map(e => ({ id: e.id, facilityId, positionId: e.shiftRoleId!, rank: e.shiftRole!.rank, isActive: e.isActive })),`

- [ ] **Step 2: `process-windows.ts`**

```ts
    const employees = await prisma.user.findMany({
      where: {
        facilityId,
        isActive: true,
        shiftRole: { code: { not: 1 } },
      },
      select: { email: true },
    });
    const recipients = employees.map((employee) => employee.email);
```

- [ ] **Step 3: `change-log/queries.ts`**

`changedBy: { select: { email: true, employee: { select: { displayName: true } } } }` -> `changedBy: { select: { displayName: true } }`, and `changedByName: row.changedBy.employee?.displayName ?? row.changedBy.email,` -> `changedByName: row.changedBy.displayName,`.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck 2>&1 | grep -E "schedules/|dashboard/|periods/|availability/"`
Expected: no output. Any remaining `Property 'employee' does not exist on type ...` error: the pattern is `x.employee?.displayName` -> `x.displayName`, `x.employee.y` -> `x.y` (the relation was on `User`, whose fields now live directly on it); fix those the same way.

---

### Task 6: Seeds and tests

**Files:**
- Modify: `prisma/seed.ts:194-215`, `prisma/seed-employees.ts:178-200`, `prisma/seed-region-courts.ts:236,352-372`, `prisma/seed-schedule.ts:62-92`, `prisma/seed-bat-yam-full-schedule.ts:169,213`, `prisma/demo-two-schedule-bat-yam.ts:365`
- Modify: `tests/scheduling-postgres.test.ts:41-43`

- [ ] **Step 1: `prisma/seed.ts` (and the same shape in `seed-employees.ts`)**

Replace `prisma.employee.create(...)` + `prisma.user.create(...)` with one call (keep the surrounding `facilityRoles`/`mustChangePassword` lines exactly as they are in each file; the new fields are the employee ones; delete `employeeId: employee.id,`):

```ts
    const passwordHash = await bcrypt.hash(emp.password, 10);

    await prisma.user.create({
      data: {
        email: emp.email,
        passwordHash,
        systemRole: emp.systemRole ?? SystemRole.USER,
        facilityRoles: emp.isManager ? { create: { facilityId: court.id, role: 'MANAGER' } } : undefined,
        mustChangePassword: emp.mustChangePassword ?? false,
        firstName: emp.firstName,
        lastName: emp.lastName,
        displayName: emp.displayName,
        phone: emp.phone ?? null,
        shiftRoleId: position.id,
        facilityId: court.id,
        isActive: true,
        isReligious: emp.isReligious ?? false,
      },
    });
```

In `seed-employees.ts` keep `systemRole: SystemRole.USER` instead of `emp.systemRole ?? ...`.

- [ ] **Step 2: `prisma/seed-region-courts.ts`**

Line 352-372: single `prisma.user.create` with `email, passwordHash: person.passwordHash, systemRole: SystemRole.USER, facilityRoles: ..., firstName: person.firstName, lastName: person.lastName, displayName: person.firstName, phone: person.phone, shiftRoleId: person.shiftRoleId, facilityId: person.facilityId, isActive: true`. Line 236: `prisma.employee.findMany(` -> `prisma.user.findMany(`.

- [ ] **Step 3: `seed-schedule.ts`, `seed-bat-yam-full-schedule.ts`, `demo-two-schedule-bat-yam.ts`**

- `seed-schedule.ts`: manager select `employee: { select: { firstName: true, lastName: true } }` -> `firstName: true, lastName: true,` and every use `manager.employee.firstName/lastName` -> `manager.firstName/lastName`; `prisma.employee.findMany(` -> `prisma.user.findMany(`.
- `seed-bat-yam-full-schedule.ts:169` `employee: { facilityId: court.id },` -> `facilityId: court.id,`; line 213 `prisma.employee.findMany(` -> `prisma.user.findMany(`.
- `demo-two-schedule-bat-yam.ts:365` `prisma.employee.findMany(` -> `prisma.user.findMany(`.

- [ ] **Step 4: `tests/scheduling-postgres.test.ts`**

```ts
    const employee = await prisma.user.create({ data: { email: `${suffix}-emp@test.invalid`, passwordHash: 'unused', facilityId, shiftRoleId: positionId, firstName: 'Test', lastName: 'Employee', displayName: 'Test Employee' } });
    employeeId = employee.id;
    const manager = await prisma.user.create({ data: { email: `${suffix}@test.invalid`, passwordHash: 'unused', systemRole: 'USER', firstName: 'Test', lastName: 'Manager', displayName: 'Test Manager', facilityId, shiftRoleId: positionId, facilityRoles: { create: { facilityId, role: 'MANAGER' } } } });
```

- [ ] **Step 5: Find any other creators/readers**

Run: `grep -rnE "prisma\.employee|tx\.employee|\.employee\b|employeeId:\s*employee" src tests prisma scripts --include='*.ts' --include='*.tsx' --exclude-dir=generated --exclude-dir=migrations`
Expected: only the legitimate nested relation names (`employee: { ... }` filters/selects on child models, `data.employee` DTO props in feature types/components). Anything else, plus every `prisma.user.create(` without `firstName/lastName/displayName`, must be fixed with the patterns above.

- [ ] **Step 6: Verify**

Run: `pnpm typecheck 2>&1 | grep -E "^prisma/|^tests/"`
Expected: no output.

---

### Task 7: Full validation and hand-off

**Files:** none modified.

- [ ] **Step 1: Run checks**

Run: `pnpm db:generate && pnpm typecheck && pnpm lint && pnpm test:run`
Expected: typecheck and lint show no new errors compared with the Task 0 baseline; unit tests pass (the postgres integration suite is skipped without `TEST_DATABASE_URL`).

- [ ] **Step 2: Integration suite (only if the user has a test DB)**

Ask the user for a safe `TEST_DATABASE_URL` that already has the migration applied. If given: `TEST_DATABASE_URL=... pnpm test:integration`. Expected: PASS. If not given, report it as not run.

- [ ] **Step 3: Seed smoke test (local DB only)**

Only on the DB confirmed in Task 0: `pnpm db:seed:employees`. Expected: runs without Prisma validation errors.

- [ ] **Step 4: Manual check**

Run `pnpm dev`; log in as (a) admin, (b) a manager, (c) an employee; confirm the employee lands on `/employee`, the manager sees the employees list, the admin sees `/admin/courts` with employees, and creating a new employee as manager lets that employee log in with the generated initial password.

- [ ] **Step 5: Diff review**

Run: `git status` and `git diff --stat`. Confirm only files listed in this plan (plus the regenerated `src/generated/prisma/*`) changed in this task, beyond the already-uncommitted unrelated work.

- [ ] **Step 6: Report**

State exactly: which DB the migration ran on, that other environments (e.g. Neon/production) still need `pnpm db:deploy`, which checks ran and which did not.
