# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Derived from the route groups `(employee)`, `(manager)`, `(admin)` and `prisma/schema.prisma`.

- **Employees (security staff at a court/facility):** belong to one facility (`User.facilityId`) and hold a shared `Role` (`rank`: officer 1, shift manager 2, controller 3, guard 4; a lower number is a higher rank). They submit availability (`AvailabilitySubmission`) before a schedule's submission window closes, view their published shifts, and file `EmployeeRequest`s (time off, shift swap, urgent absence).
- **Managers / schedulers (`User.canEditSchedule: true`):** generate, review, and publish the 7- or 14-day schedule for their facility, resolve scheduling warnings, make manual edits (`ScheduleSlot.source`, `isLocked`), and approve employee requests.
- **Admins (`SystemRole.ADMIN`):** configure districts, facilities, positions, and system settings across the organization.

## Product Purpose

Generates and manages shift schedules for security staff across court facilities, replacing manual/ad-hoc scheduling. The system enforces hard constraints (no double-booking, valid consecutive shifts, per-court/day/shift-type/position capacity) before applying fairness scoring (total shifts, weekend shifts, opening duties). Employees submit availability before the window closes; managers generate, review, and publish the resulting schedule. The scheduling rules are in `AGENTS.md` and `docs/scheduling-priorities.md`.

## Positioning

Not defined. This appears to be an internal/operational tool, so no market positioning is recorded here.

## Operating Context

- Organized as District → Facility (court) → Position/Shift.
- A `Schedule` covers 7 or 14 days and carries its own submission window (`submissionOpensAt`, `submissionClosesAt`); the window logic lives in `src/features/periods`.
- Schedule generation lives in `src/features/scheduling-engine` (constraints, fairness, scoring, weekly minimums, role eligibility, warnings, validation).
- A Vercel cron (`vercel.json`, daily at 05:00 UTC) calls `src/app/api/cron/submission-windows` to open and close submission windows; the daily frequency fits the Vercel Hobby plan.
- UI is Hebrew RTL throughout.

## Capabilities and Constraints

- Hard constraints must hold before fairness scoring: no double-booking an employee, no invalid consecutive shifts, capacity respected per court, day, shift type, and position.
- Fairness scoring considers total shifts, weekend shifts, and opening duties.
- Position eligibility is rank-based: an employee's `Role.rank` is compared with `Position.requiredRank` (`role-eligibility.ts`).
- Shift types: MORNING, EVENING, NIGHT (`ShiftType`). Day categories: WEEKDAY, FRIDAY, SATURDAY (`DayCategory`).
- Schedules and versions follow a draft → published → archived lifecycle (`ScheduleStatus`); the original published version is immutable and later edits are tracked in `ScheduleChange`.
- Deactivated employees cannot log in or be scheduled, but their history is preserved (`User.isActive`).
- Stack: Next.js App Router, TypeScript, Prisma + PostgreSQL, shadcn/ui.

## Evidence on Hand

No real facility or district names, testimonials, case studies, or labor-law citations are recorded in the repo. Future design work must not fabricate named courts, testimonials, compliance certifications, or pricing; treat this as an internal operational tool with no public marketing claims unless provided.

## Product Principles

1. Hard scheduling constraints are non-negotiable and always evaluated before fairness/soft scoring.
2. Fairness is a tracked, auditable property of the system (shift counts, weekend shifts, opening duties), not an informal judgment call.
3. The 7- or 14-day schedule with its submission window is the fixed rhythm of the workflow (employee submission → manager generation/review/publish).
4. Rank (`Role.rank`) decides which positions an employee may fill; edit authority is a separate flag (`canEditSchedule`). Don't conflate the two in UI or logic.

## Accessibility & Inclusion

Hebrew RTL UI is a firm requirement across the product (see `AGENTS.md` "UI rules": keep Hebrew labels, preserve RTL layout). No other accessibility standard has been specified.
