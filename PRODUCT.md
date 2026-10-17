# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

[Inferred from route groups `(employee)`, `(manager)`, `(admin)` and the Prisma schema — not confirmed with the user; the interview was declined, see note below.]

- **Employees (security guards at a court/facility):** log in per facility (`User.facilityId`), hold a `Role` with a `rank` and an `EmployeeCapability`/`Capability` level (GUARD / CONTROLLER / SHIFT_MANAGER by rank), submit biweekly availability (`AvailabilitySubmission`) before a period locks, and view their own published shifts.
- **Managers / schedulers (`canEditSchedule: true` users, rank-gated via `Role`):** generate, review, and publish the 14-day schedule for their facility, resolve `ScheduleWarning`s, and make manual overrides (`ScheduleSlot.isManualOverride`).
- **Admins (`SystemRole.ADMIN`):** configure districts, facilities, positions, capabilities, and system settings across the org.

Note: `ARCHITECTURE_PROPOSAL.md` describes a richer four-tier role hierarchy (District Security Officer, Facility Officer, Shift Manager, Controller, Guard) that is explicitly flagged in that file as historical and not what's implemented. The real schema uses a flat `SystemRole` (`USER`/`ADMIN`) plus a per-facility `Role` with `rank`, and capability level is tracked separately via `Capability`/`EmployeeCapability`.

## Product Purpose

[Inferred from `prisma/schema.prisma` and `CLAUDE.md`'s "Scheduling domain rules" — not confirmed with the user.]

Generates and manages shift schedules for security guards across court facilities, replacing manual/ad-hoc scheduling. The system enforces hard constraints (no double-booking, valid consecutive shifts, per-court/day/shift-type/position capacity) before applying fairness scoring (total shifts, weekend shifts, opening duties) across employees. Scheduling periods are 14 days; employees submit availability before a period locks, and managers generate, review, and publish the resulting schedule.

## Positioning

[Not confirmed — the interview to establish this was declined. No inferred claim is recorded here to avoid fabricating a competitive position for what may be an internal/government tool rather than a market product.]

## Operating Context

- Organized as District → Facility (court) → Position/Shift structure.
- Scheduling periods run 14 days, with submission-open and submission-deadline windows (`SchedulePeriod` / period lifecycle in `src/features/periods`).
- Schedule generation logic lives in `src/features/scheduling-engine` (constraints, fairness, scoring, weekly minimums, role eligibility, warnings, validation).
- A cron job runs daily (`src/app/api/cron`) to manage the submission window — noted in recent commit history ("Run submission-window cron daily to fit the Vercel Hobby plan"), implying deployment on Vercel's Hobby tier.
- UI is Hebrew RTL throughout (per `CLAUDE.md` project instructions and inline Hebrew comments in the schema, e.g. on `User.isActive`).

## Capabilities and Constraints

- Hard constraints (must hold before fairness scoring applies): no double-booking an employee; no invalid consecutive shifts; capacity respected per court, day, shift type, and position.
- Fairness scoring considers: total shifts, weekend shifts, and opening duties.
- Employee capability levels: GUARD / CONTROLLER / SHIFT_MANAGER, each with a rank, used for position eligibility (`PositionRequirement`, `role-eligibility.ts`).
- Shift types: MORNING, EVENING, NIGHT (`ShiftType` enum).
- Schedules have a draft → published → archived lifecycle (`ScheduleStatus`).
- Deactivated employees cannot log in or be scheduled, but their history is preserved (per schema comment on `User.isActive`).
- Stack/tech constraints: Next.js App Router, TypeScript, Prisma + PostgreSQL, shadcn/ui — not asked about since this is an existing, non-greenfield codebase.

## Evidence on Hand

[Not confirmed with the user — the interview was declined.] No real facility/district names, customer testimonials, case studies, or specific labor-law citations were found in the repo beyond generic domain structure. Future design work must not fabricate named courts, testimonials, compliance certifications, or pricing — treat this as an internal/operational tool with no public-facing marketing claims unless the user provides them.

## Product Principles

[Derived from the confirmed schema/domain rules above; not validated with the user as strategic principles.]

1. Hard scheduling constraints are non-negotiable and always evaluated before fairness/soft scoring.
2. Fairness is a tracked, auditable property of the system (shift counts, weekend shifts, opening duties), not an informal judgment call.
3. The 14-day period and its submission-deadline/lock mechanic is the fixed rhythm the whole workflow (employee submission → manager generation/review/publish) is built around.
4. Role and capability are modeled separately (`Role.rank` for scheduling authority, `Capability` for position eligibility) — don't conflate the two in UI or logic.

## Accessibility & Inclusion

[Not confirmed beyond what CLAUDE.md states.] Hebrew RTL UI is a firm requirement across the product (see project CLAUDE.md "UI rules": keep Hebrew labels, preserve RTL layout). No other accessibility standard was confirmed with the user.

---

**Note on how this file was produced:** the interactive interview (AskUserQuestion) for this `init` run was declined by the user, so every section above marked "not confirmed" / "inferred" was derived from repository evidence (Prisma schema, `ARCHITECTURE_PROPOSAL.md`, `CLAUDE.md`, route structure, recent commits) rather than from a direct answer. In particular, **Positioning** and **Evidence on Hand** are left largely open because fabricating them would violate this skill's rules. Re-run `/impeccable init` and answer the interview (or just tell me the answers directly in chat) to firm these up — especially positioning/success criteria and any real evidence that should be on record.
