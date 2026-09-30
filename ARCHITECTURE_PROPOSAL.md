# Workforce Scheduling System - Architecture Proposal

> **הצעה מקורית — אינה מתארת את הסכמה שמומשה.** המימוש נמצא ב-[Prisma schema](prisma/schema.prisma): `District`, `Facility`, `UserFacilityRole`, `ShiftRole`, `AvailabilitySubmission`. עמודות המפתח הן `facilityId` ו־`districtId`. `SystemRole` הוא `USER` או `ADMIN`; ניהול מתקן הוא `FacilityRole.MANAGER`.

הטקסט שלהלן נשאר כהצעה היסטורית.

## 1. Domain Model

```
District (מחוז)
├── District Security Officer (קצין ביטחון מחוזי)
├── Deputy District Security Officer (סגן קצין ביטחון מחוזי)
└── Facility (מתקן/בית משפט)
    ├── Facility Officer (קצין מתקן)
    ├── Shift Manager (אחמ"ש) - Capability: SHIFT_MANAGER
    ├── Controller (בקר) - Capability: CONTROLLER
    └── Security Guard (מאבטח) - Capability: GUARD
```

**Capability Hierarchy**: `GUARD (1) < CONTROLLER (2) < SHIFT_MANAGER (3)` — higher can fill lower.

---

## 2. Entities & Tables

| Entity | Key Fields |
|--------|------------|
| **District** | `id`, `name`, `code` (unique) |
| **Facility** | `id`, `districtId`, `name`, `code`, `timezone`, submission windows |
| **User** | `id`, `email`, `passwordHash`, `systemRole` (EMPLOYEE \| FACILITY_OFFICER \| DISTRICT_OFFICER \| ADMIN), `employeeId?` |
| **UserDistrictRole** | `userId`, `districtId`, `role` (DISTRICT_SECURITY_OFFICER \| DEPUTY_DISTRICT_SECURITY_OFFICER) |
| **UserFacilityRole** | `userId`, `facilityId`, `role` (FACILITY_OFFICER \| SHIFT_MANAGER \| CONTROLLER \| GUARD) |
| **Employee** | `id`, `facilityId`, `firstName`, `lastName`, `displayName`, `employeeNumber`, `isActive`, `isReligious` |
| **Capability** | `id`, `level` (GUARD \| CONTROLLER \| SHIFT_MANAGER), `rank` (1/2/3) |
| **EmployeeCapability** | `employeeId` (unique), `capabilityId`, `effectiveFrom`, `effectiveTo?` |
| **WorkPosition** | `id`, `facilityId`, `name`, `code`, `displayOrder`, `color`, `isActive` |
| **PositionRequirement** | `positionId`, `capabilityId`, `isPrimary` |
| **ShiftRequirement** | `facilityId`, `positionId`, `shiftType` (MORNING/EVENING/NIGHT), `dayCategory` (WEEKDAY/FRIDAY/SATURDAY/HOLIDAY), `shiftClassification` (REGULAR/NIGHT/WEEKEND_BONUS/HOLIDAY/SPECIAL), `requiredCount`, `minCount?` |
| **SchedulePeriod** | `id`, `facilityId`, `name`, `status`, `submissionOpensAt`, `submissionDeadline`, `startDate`, `endDate`, lifecycle timestamps |
| **Schedule** | `id`, `facilityId`, `periodId` (unique), `status`, `version`, `publishedAt`, `createdById` |
| **ScheduleVersion** | `id`, `scheduleId`, `facilityId`, `version`, `status`, `isActive`, `publishedAt`, `note` |
| **Assignment** | `id`, `scheduleId`, `versionId`, `employeeId`, `facilityId`, `positionId`, `date`, `shiftType`, `shiftClassification`, `slotIndex`, `isManualOverride` |
| **Submission** | `id`, `periodId`, `employeeId`, `facilityId`, `status` (DRAFT/SUBMITTED/WITHDRAWN), `submittedAt` |
| **SubmissionShift** | `id`, `submissionId`, `date`, `shiftType`, `shiftClassification`, `type` (AVAILABLE/PREFERRED/UNAVAILABLE), `positionId?`, `priority` |
| **FairnessSnapshot** | `id`, `employeeId`, `scheduleId`, `facilityId`, `periodStart`, `periodEnd`, `periodType` (SCHEDULE_PERIOD/MONTHLY/QUARTERLY/CUSTOM), counters for all shift types |
| **AuditLog** | `id`, `scheduleId`, `versionId?`, `assignmentId?`, `employeeId?`, `facilityId`, `changedById`, `action`, `entityType`, `entityId`, `fieldName?`, `oldValue?`, `newValue?`, `reason?` |
| **ScheduleWarning** | `id`, `scheduleId`, `versionId?`, `type`, `severity`, `employeeId?`, `facilityId?`, `positionId?`, `date?`, `message`, `metadata?` |
| **Holiday** | `id`, `date` (unique), `name`, `kind`, `behavesAs`, `isNational`, `facilityId?` |
| **SystemConfig** | `key` (PK), `value` (JSON) |

---

## 3. Relationships

```
District (1) ──────< (N) Facility
Facility (1) ──────< (N) Employee
Facility (1) ──────< (N) WorkPosition
Facility (1) ──────< (N) ShiftRequirement
Facility (1) ──────< (N) SchedulePeriod
Facility (1) ──────< (N) UserFacilityRole
District (1) ──────< (N) UserDistrictRole

Employee (1) ──────|| (1) EmployeeCapability
Capability (1) ────< (N) EmployeeCapability
Capability (1) ────< (N) PositionRequirement
WorkPosition (1) ──< (N) PositionRequirement

WorkPosition (1) ──< (N) ShiftRequirement

SchedulePeriod (1) ──|| (1) Schedule
Schedule (1) ───────< (N) ScheduleVersion
ScheduleVersion (1) ──< (N) Assignment
Assignment references: Schedule, ScheduleVersion, Employee, Facility, WorkPosition

SchedulePeriod (1) ──< (N) Submission
Employee (1) ───────< (N) Submission
Submission (1) ─────< (N) SubmissionShift

Schedule (1) ───────< (N) FairnessSnapshot
Employee (1) ───────< (N) FairnessSnapshot

Schedule (1) ───────< (N) AuditLog
ScheduleVersion (1) < (N) AuditLog
Assignment (1) ─────< (N) AuditLog
Employee (1) ───────< (N) AuditLog (via EmployeeAuditLogs)
User (1) ───────────< (N) AuditLog
```

---

## 4. Permissions & RLS Strategy

### System Roles
- `EMPLOYEE` — can only submit own availability, view own schedule
- `FACILITY_OFFICER` — full control over one facility
- `DISTRICT_OFFICER` — read-only across district facilities
- `ADMIN` — global access

### Permission Keys
```
OPEN_PERIOD, CLOSE_PERIOD, VIEW_SUBMISSIONS,
GENERATE_SCHEDULE, EDIT_SCHEDULE, PUBLISH_SCHEDULE, MODIFY_ACTIVE_SCHEDULE,
MANAGE_EMPLOYEES, MANAGE_CAPABILITIES,
MANAGE_POSITIONS, MANAGE_SHIFT_REQUIREMENTS,
VIEW_FAIRNESS, VIEW_AUDIT_LOG, EXPORT_SCHEDULE,
MANAGE_USERS, GRANT_PERMISSIONS, MANAGE_DISTRICTS, MANAGE_FACILITIES, MANAGE_HOLIDAYS
```

### RLS (PostgreSQL Row Level Security)
Session variables set per request:
```sql
SET LOCAL app.current_role = 'FACILITY_OFFICER';
SET LOCAL app.current_district_id = 'dist_abc';
SET LOCAL app.current_facility_id = 'fac_xyz';
SET LOCAL app.current_employee_id = 'emp_123';
SET LOCAL app.current_user_id = 'usr_456';
```

Key policies:
- **District**: `app.is_admin() OR (app.current_role='DISTRICT_OFFICER' AND district_id=current_district_id)`
- **Facility**: `app.can_read_facility(facility_id)` — admin, district officer of that district, or facility officer/employee of that facility
- **Employee**: facility read + `app.current_employee_id = id` for self
- **Submission**: facility read + employee can only write own
- **Schedule/Assignment/Audit**: facility-scoped via schedule → facility

---

## 5. Scheduling Lifecycle

```
DRAFT
  │ Facility Officer clicks "Open Submissions"
  ▼
OPEN_FOR_SUBMISSIONS ──► Employees submit (deadline enforced)
  │ Auto-close at deadline OR manual close
  ▼
SUBMISSIONS_CLOSED
  │ Facility Officer clicks "Generate"
  ▼
SCHEDULING ──► Engine runs, officer adjusts
  │ Officer clicks "Publish"
  ▼
PUBLISHED ──► Auto-activate at startDate (cron)
  ▼
ACTIVE ──► Modifiable with audit trail
  │ Auto-complete at endDate+1 (cron)
  ▼
COMPLETED ──► Archive after retention
  ▼
ARCHIVED
```

**State Transitions Table**

| From | To | Trigger | Actor |
|------|-----|---------|-------|
| DRAFT | OPEN_FOR_SUBMISSIONS | Manual open | Facility Officer |
| OPEN_FOR_SUBMISSIONS | SUBMISSIONS_CLOSED | Deadline / Manual close | System / Facility Officer |
| SUBMISSIONS_CLOSED | SCHEDULING | Generate schedule | Facility Officer |
| SCHEDULING | PUBLISHED | Publish | Facility Officer |
| PUBLISHED | ACTIVE | startDate reached | System (cron) |
| ACTIVE | COMPLETED | endDate passed | System (cron) |
| COMPLETED | ARCHIVED | Retention / Manual | System / Facility Officer |

---

## 6. Fairness Model

### FairnessSnapshot (per employee per period)
```typescript
{
  employeeId, scheduleId, facilityId,
  periodStart, periodEnd, periodType,
  totalShifts, morningShifts, eveningShifts, nightShifts,
  weekendShifts, holidayShifts, specialShifts,
  weekendBonusShifts, totalHours
}
```

### FairnessService API
```typescript
calculateFairness(facilityId, periodStart, periodEnd, periodType, scheduleId?)
getFairnessStats(facilityId, periodStart, periodEnd)
getFairnessWarnings(facilityId, scheduleId, thresholds)
getFairnessRecommendations(facilityId, scheduleId, unfilledSlots, availableEmployees)
```

### Thresholds (configurable via SystemConfig)
- `maxNightShiftDeviation` (default 2.0 std devs)
- `maxWeekendBonusDeviation` (default 1.5)
- `maxTotalShiftDeviation` (default 2.0)
- `minShiftsPerPeriod` / `maxShiftsPerPeriod`

### Scheduler Integration
Scoring penalizes employees above mean:
```
score = baseScore - (nightDeviation>1?10:0) - (wkndDeviation>1?10:0) - (totalDeviation>1.5?5:0)
```

---

## 7. Audit / Versioning

### AuditLog captures every mutation
- `action`: CREATE, UPDATE, DELETE, PUBLISH, ASSIGN, UNASSIGN, SWAP, MANUAL_OVERRIDE, etc.
- `entityType` + `entityId` + `fieldName` + `oldValue`/`newValue` (JSON)
- `reason` required for manual overrides on ACTIVE schedules
- Indexed by `scheduleId`, `versionId`, `assignmentId`, `employeeId`, `changedById`, `createdAt`

### ScheduleVersion
- New version created on every edit after PUBLISH
- `isActive` flags current published version
- Immutable history retained forever

---

## 8. Mermaid ER Diagram

```mermaid
erDiagram
    District ||--o{ Facility : contains
    District ||--o{ UserDistrictRole : has
    Facility ||--o{ Employee : employs
    Facility ||--o{ WorkPosition : "has positions"
    Facility ||--o{ ShiftRequirement : "defines staffing"
    Facility ||--o{ SchedulePeriod : "has periods"
    Facility ||--o{ UserFacilityRole : "has roles"
    
    User ||--o| Employee : "linked to"
    User ||--o{ UserDistrictRole : "district roles"
    User ||--o{ UserFacilityRole : "facility roles"
    User ||--o{ UserPermission : permissions
    User ||--o{ AuditLog : performs
    
    Capability ||--o{ EmployeeCapability : assigned
    Capability ||--o{ PositionRequirement : required by
    Employee ||--|| EmployeeCapability : has
    WorkPosition ||--o{ PositionRequirement : requires
    
    WorkPosition ||--o{ ShiftRequirement : staffing rules
    
    SchedulePeriod ||--|| Schedule : generates
    Schedule ||--o{ ScheduleVersion : versions
    ScheduleVersion ||--o{ Assignment : contains
    SchedulePeriod ||--o{ Submission : collects
    Employee ||--o{ Submission : submits
    Submission ||--o{ SubmissionShift : includes
    
    Assignment }|--|| Schedule : belongs to
    Assignment }|--|| ScheduleVersion : in version
    Assignment }|--|| Employee : assigned to
    Assignment }|--|| Facility : at facility
    Assignment }|--|| WorkPosition : fills position
    
    Schedule ||--o{ FairnessSnapshot : tracks
    Employee ||--o{ FairnessSnapshot : snapshots
    Facility ||--o{ FairnessSnapshot : for facility
    
    Schedule ||--o{ AuditLog : audited
    ScheduleVersion ||--o{ AuditLog : version audited
    Assignment ||--o{ AuditLog : assignment audited
    Employee ||--o{ AuditLog : employee audited
    Facility ||--o{ AuditLog : facility audited
    User ||--o{ AuditLog : actor
    
    Schedule ||--o{ ScheduleWarning : warnings
    ScheduleVersion ||--o{ ScheduleWarning : version warnings
    Employee ||--o{ ScheduleWarning : employee warnings
    Facility ||--o{ ScheduleWarning : facility warnings
    WorkPosition ||--o{ ScheduleWarning : position warnings
    
    Facility ||--o{ Holiday : facility holidays
```

---

## 9. Key Constraints & Indexes

### Check Constraints
- `ShiftRequirement.minCount <= requiredCount`
- `SchedulePeriod.startDate < endDate`
- `SchedulePeriod.submissionDeadline <= startDate`
- `Assignment.slotIndex >= 0`
- `EmployeeCapability.effectiveFrom <= effectiveTo`
- `FairnessSnapshot.periodStart <= periodEnd`

### Critical Unique Constraints
- `Submission(periodId, employeeId)` — one per employee per period
- `Assignment(versionId, employeeId, date, shiftType, slotIndex)` — no double-book
- `FairnessSnapshot(employeeId, scheduleId, periodType)`
- `WorkPosition(facilityId, name)`, `WorkPosition(facilityId, code)`
- `ShiftRequirement(facilityId, positionId, shiftType, dayCategory, shiftClassification)`

### Important Indexes
- `Assignment(versionId, date)`, `Assignment(versionId, date, shiftType, positionId)`
- `Assignment(employeeId, date)`, `Assignment(facilityId, date)`
- `SchedulePeriod(facilityId, status)`, `SchedulePeriod(facilityId, startDate, endDate)`
- `AuditLog(scheduleId, createdAt)`, `AuditLog(employeeId, createdAt)`, `AuditLog(action, createdAt)`
- `Submission(periodId)`, `Submission(employeeId)`, `Submission(facilityId, status)`

---

## 10. Migration Plan (10 Weeks)

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **1. Foundation** | Week 1-2 | New Prisma models (District, Capability, EmployeeCapability, WorkPosition, PositionRequirement, ShiftRequirement, UserDistrictRole, UserFacilityRole); rename Region→District, Court→Facility, ShiftCapacity→ShiftRequirement; seed capabilities |
| **2. Auth & RLS** | Week 2-3 | Updated RLS policies for district/facility hierarchy; session variable middleware; UserFacilityRole/DistrictRole assignment UI; new permission keys |
| **3. Lifecycle** | Week 3-4 | SchedulePeriodStatus enum with 8 states; lifecycle timestamps; state transition APIs; cron jobs for auto-transitions; notifications |
| **4. Submissions** | Week 4-5 | Submission/SubmissionShift models; AVAILABLE/PREFERRED/UNAVAILABLE + positionId + priority; employee submission UI; validation |
| **5. Scheduler** | Week 5-6 | Map ShiftRequirement→EngineCapacity; EmployeeCapability→eligibility; SubmissionShift→availability; shiftClassification on Assignment |
| **6. Fairness** | Week 6-7 | FairnessSnapshot + FairnessService; period types (SCHEDULE_PERIOD/MONTHLY/QUARTERLY); thresholds config; scheduler integration; dashboard |
| **7. Audit** | Week 7-8 | Enhanced AuditLog (fieldName, oldValue, newValue, reason); immutable ScheduleVersion on edit; audit logging on all mutations; audit viewer UI |
| **8. Data Migration** | Week 8-9 | Backfill EmployeeCapability from Position codes; PositionRequirement from role-eligibility logic; ShiftRequirement from ShiftCapacity; UserFacilityRole for existing managers |
| **9. Testing** | Week 9 | Integration tests for all flows; RLS penetration tests; scheduler correctness; fairness accuracy |
| **10. Deploy** | Week 10 | Documentation; runbooks; production deploy |

---

## 11. What to Keep / Refactor

| Keep | Refactor |
|------|----------|
| Prisma + PostgreSQL | SystemRole enum → add FACILITY_OFFICER, DISTRICT_OFFICER |
| NextAuth.js | Position → split into EmployeeCapability + WorkPosition |
| RLS (extend to district) | Role eligibility → data-driven via PositionRequirement |
| Scheduling Engine (pure TS) | ShiftType → add ShiftClassification |
| Fairness basics | ScheduleStatus → SchedulePeriodStatus (8 states) |
| AuditLog structure | User-Facility link → UserFacilityRole |
| Holiday model | Permission system → full RBAC with explicit grants |
| SystemConfig | AvailabilityForm → Submission (richer model) |

---

## 12. Open Decisions (Require Confirmation)

1. **Shift times**: Fixed (06-14/14-22/22-06) or configurable per facility via `ShiftTemplate`?
2. **Weekend definition**: Fri-Sat only (Israel) or configurable?
3. **Cross-facility work**: Not allowed currently — need `EmployeeFacilityAssignment` if yes?
4. **Part-time employees**: Add `employmentType` + `maxShiftsPerPeriod`?
5. **Shift swaps**: Employee-initiated `SwapRequest` workflow?
6. **Recurring templates**: `ScheduleTemplate` for repeating patterns (v2)?
7. **Min rest hours**: Facility-level default 8h, override per position?
8. **Max consecutive shifts**: Facility-level default 5?
9. **Religious auto-exclude**: `isReligious` → auto UNAVAILABLE Fri/Sat?
