# סכמה מלאה — יעד לפי התוכנית שאושרה

התרשים שומר על `Region` ו־`Court`, בהתאם לתוכנית שאושרה. בעת יצירתו, בקובץ המקור הופיעו הכותרות `District` ו־`Facility` אך הקשרים עדיין הפנו לשמות הקודמים. זהו תיעוד יעד; קובץ הסכמה לא שונה. ניהול מחוזי אינו כלול.

כל 22 המודלים וכל השדות הסקלריים מוצגים. `PK` מפתח ראשי, `FK` מפתח זר, `UK` ייחודיות בשדה יחיד. מפתחות מורכבים ואינדקסים מפורטים בהמשך. `nullable` מציין שדה אופציונלי. קווים מתארים קשרי מסד בלבד; ל־Holiday ול־SystemConfig אין קשרי FK.

```mermaid
erDiagram
    User ||--o{ Account : "user"
    User ||--o{ Session : "user"
    Employee |o--o| User : "employee"
    User ||--o{ UserCourtRole : "user"
    Court ||--o{ UserCourtRole : "court"
    User ||--o{ UserPermission : "user"
    User ||--o{ UserPermission : "grantedBy"
    Region ||--o{ Court : "region"
    Court ||--o{ Employee : "court"
    Position ||--o{ Employee : "position"
    Court ||--o{ Position : "court"
    Court ||--o{ ShiftCapacity : "court"
    Position ||--o{ ShiftCapacity : "position"
    SchedulePeriod ||--o{ AvailabilitySubmission : "period"
    Employee ||--o{ AvailabilitySubmission : "employee"
    AvailabilitySubmission ||--o{ ShiftAvailability : "form"
    Court ||--o{ SchedulePeriod : "court"
    Court ||--o{ Roster : "court"
    SchedulePeriod ||--o| Roster : "period"
    User ||--o{ Roster : "createdBy"
    Roster ||--o{ RosterVersion : "schedule"
    Court ||--o{ RosterVersion : "court"
    User ||--o{ RosterVersion : "createdBy"
    Roster ||--o{ ShiftAssignment : "schedule"
    RosterVersion ||--o{ ShiftAssignment : "version"
    Employee ||--o{ ShiftAssignment : "employee"
    Court ||--o{ ShiftAssignment : "court"
    Position ||--o{ ShiftAssignment : "position"
    RosterVersion |o--o{ ScheduleWarning : "version"
    Roster ||--o{ ScheduleWarning : "schedule"
    Employee |o--o{ ScheduleWarning : "employee"
    Court |o--o{ ScheduleWarning : "court"
    Position |o--o{ ScheduleWarning : "position"
    RosterVersion |o--o{ FairnessRecord : "version"
    Employee ||--o{ FairnessRecord : "employee"
    Roster ||--o{ FairnessRecord : "schedule"
    Roster ||--o{ ScheduleChangeLog : "schedule"
    RosterVersion |o--o{ ScheduleChangeLog : "version"
    ShiftAssignment |o--o{ ScheduleChangeLog : "shiftAssignment"
    User ||--o{ ScheduleChangeLog : "changedBy"
    Account {
        string id PK
        string userId FK
        string type
        string provider
        string providerAccountId
        string refresh_token "nullable"
        string access_token "nullable"
        int expires_at "nullable"
        string token_type "nullable"
        string scope "nullable"
        string id_token "nullable"
        string session_state "nullable"
    }
    Session {
        string id PK
        string sessionToken UK
        string userId FK
        datetime expires
    }
    VerificationToken {
        string identifier
        string token UK
        datetime expires
    }
    User {
        string id PK
        string email UK
        string passwordHash
        enum systemRole "SystemRole"
        boolean mustChangePassword
        string employeeId FK,UK "nullable"
        datetime createdAt
        datetime updatedAt
    }
    UserCourtRole {
        string userId PK,FK
        string courtId PK,FK
    }
    UserPermission {
        string id PK
        string userId FK
        string permissionKey
        boolean granted
        string grantedById FK
        string note "nullable"
        datetime expiresAt "nullable"
        datetime createdAt
        datetime updatedAt
    }
    Region {
        string id PK
        string name
        string code UK
        datetime createdAt
        datetime updatedAt
    }
    Court {
        string id PK
        string name
        string code UK
        string regionId FK
        int submissionOpenWeekday "nullable"
        string submissionOpenTime "nullable"
        int submissionCloseWeekday "nullable"
        string submissionCloseTime "nullable"
        datetime createdAt
        datetime updatedAt
    }
    Employee {
        string id PK
        string firstName
        string lastName
        string displayName
        string phone "nullable"
        string positionId FK
        string courtId FK
        boolean isActive
        boolean isReligious
        enum capability "Capability"
        datetime createdAt
        datetime updatedAt
    }
    Position {
        string id PK
        string courtId FK
        string name
        int code
        int displayOrder
        boolean isActive
        string color "nullable"
        enum requiredCapability "Capability"
        datetime createdAt
        datetime updatedAt
    }
    ShiftCapacity {
        string id PK
        string courtId FK
        string positionId FK
        enum shiftType "ShiftType"
        enum dayCategory "DayCategory"
        int requiredCount
        boolean isActive
        int displayOrder
        datetime createdAt
        datetime updatedAt
    }
    Holiday {
        string id PK
        date date
        string name
        enum kind "HolidayKind"
        enum behavesAs "DayCategory"
        datetime createdAt
        datetime updatedAt
    }
    AvailabilitySubmission {
        string id PK
        string periodId FK
        string employeeId FK
        boolean isSubmitted
        datetime submittedAt "nullable"
        string note "nullable"
        datetime createdAt
        datetime updatedAt
    }
    ShiftAvailability {
        enum preference "AvailabilityPreference"
        string id PK
        string submissionId FK
        date date
        enum shiftType "ShiftType"
        datetime createdAt
        datetime updatedAt
    }
    SchedulePeriod {
        enum submissionState "SubmissionState"
        string id PK
        string courtId FK
        string name
        datetime submissionOpensAt
        datetime submissionDeadline
        datetime submissionNotifiedAt "nullable"
        boolean submissionWindowManaged
        date startDate
        date endDate
        datetime createdAt
        datetime updatedAt
    }
    Roster {
        string id PK
        string courtId FK
        string periodId FK,UK
        enum status "ScheduleStatus"
        datetime generatedAt
        datetime publishedAt "nullable"
        string createdById FK
        datetime createdAt
        datetime updatedAt
    }
    RosterVersion {
        int revision
        string id PK
        string scheduleId FK
        string courtId FK
        int version
        enum status "ScheduleVersionStatus"
        boolean isActive
        datetime publishedAt "nullable"
        string createdById FK
        string note "nullable"
        datetime createdAt
        datetime updatedAt
    }
    ShiftAssignment {
        enum source "AssignmentSource"
        boolean isLocked
        string id PK
        string scheduleId FK
        string versionId FK
        string employeeId FK
        string courtId FK
        string positionId FK
        date date
        enum shiftType "ShiftType"
        datetime createdAt
        datetime updatedAt
    }
    ScheduleWarning {
        string versionId FK "nullable"
        string id PK
        string scheduleId FK
        enum type "WarningType"
        enum severity "WarningSeverity"
        string employeeId FK "nullable"
        string courtId FK "nullable"
        string positionId FK "nullable"
        enum shiftType "nullable; ShiftType"
        date date "nullable"
        string message
        datetime createdAt
        datetime updatedAt
    }
    FairnessRecord {
        string versionId FK "nullable"
        string id PK
        string employeeId FK
        string scheduleId FK
        int totalShifts
        int morningShifts
        int eveningShifts
        int nightShifts
        int weekendShifts
        int totalHours
        datetime createdAt
        datetime updatedAt
    }
    ScheduleChangeLog {
        string id PK
        string scheduleId FK
        string versionId FK "nullable"
        string shiftAssignmentId FK "nullable"
        string changedById FK
        enum changeType "ScheduleChangeType"
        string message "nullable"
        string reason "nullable"
        json beforeData "nullable"
        json afterData "nullable"
        datetime createdAt
    }
    SystemConfig {
        string key PK
        json value
        datetime createdAt
        datetime updatedAt
    }
```

## ערכים מותרים

- `Capability`: `GUARD`, `CONTROLLER`, `SHIFT_MANAGER`
- `AvailabilityPreference`: `AVAILABLE`, `PREFERRED`, `UNAVAILABLE`
- `SubmissionState`: `SCHEDULED`, `OPEN`, `CLOSED`
- `AssignmentSource`: `MANUAL`, `AUTOMATIC`
- `SystemRole`: `EMPLOYEE`, `MANAGER`, `ADMIN`
- `ScheduleChangeType`: `CREATE`, `UPDATE`, `DELETE`, `PUBLISH`, `MANUAL_OVERRIDE`
- `ShiftType`: `MORNING`, `EVENING`, `NIGHT`
- `ScheduleVersionStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `DayCategory`: `WEEKDAY`, `FRIDAY`, `SATURDAY`
- `HolidayKind`: `EVE`, `HOLIDAY`, `SPECIAL_DAY`
- `ScheduleStatus`: `DRAFT`, `OPEN`, `LOCKED`, `PUBLISHED`, `ARCHIVED`
- `WarningType`: `UNDERSTAFFED`, `UNFILLED`, `MIN_NOT_MET`, `CONFLICT`, `FAIRNESS`
- `WarningSeverity`: `ERROR`, `WARNING`, `INFO`

## מפתחות מורכבים ואינדקסים

ייחודיות בשדה יחיד כבר מסומנת בתרשים. הגדרות Prisma ברמת המודל:

### Account

```prisma
@@unique([provider, providerAccountId])
```

### VerificationToken

```prisma
@@unique([identifier, token])
```

### User

```prisma
@@index([systemRole])
```

### UserCourtRole

```prisma
@@id([userId, courtId])
@@index([courtId])
```

### UserPermission

```prisma
@@unique([userId, permissionKey])
@@index([userId])
@@index([grantedById])
```

### Court

```prisma
@@index([regionId])
```

### Employee

```prisma
@@unique([id, courtId])
@@index([courtId])
@@index([courtId, isActive])
@@index([positionId])
@@index([positionId, courtId])
```

### Position

```prisma
@@unique([courtId, name])
@@unique([courtId, code])
@@unique([id, courtId])
@@index([courtId])
@@index([courtId, displayOrder])
```

### ShiftCapacity

```prisma
@@unique([courtId, positionId, shiftType, dayCategory])
@@index([courtId, isActive])
@@index([courtId, shiftType, dayCategory])
@@index([positionId])
@@index([positionId, courtId])
@@index([courtId, displayOrder])
```

### Holiday

```prisma
@@unique([date])
@@index([behavesAs])
```

### AvailabilitySubmission

```prisma
@@unique([periodId, employeeId])
@@index([employeeId])
@@index([periodId])
```

### ShiftAvailability

```prisma
@@unique([submissionId, date, shiftType])
@@index([date, shiftType])
```

### SchedulePeriod

```prisma
@@unique([id, courtId])
@@index([courtId])
@@index([courtId, endDate])
@@index([courtId, startDate, endDate])
@@index([startDate, endDate])
```

### Roster

```prisma
@@unique([id, courtId])
@@unique([periodId, courtId])
@@index([courtId])
@@index([status])
@@index([courtId, status])
@@index([createdById])
```

### RosterVersion

```prisma
@@unique([id, scheduleId, courtId])
@@unique([scheduleId, version])
@@index([scheduleId])
@@index([courtId])
@@index([status])
@@index([isActive])
@@index([scheduleId, status, isActive, version])
```

### ShiftAssignment

```prisma
@@unique([versionId, employeeId, date, shiftType])
@@index([scheduleId])
@@index([versionId])
@@index([versionId, date])
@@index([versionId, date, shiftType, positionId])
@@index([scheduleId, date])
@@index([scheduleId, courtId])
@@index([employeeId, courtId])
@@index([positionId, courtId])
@@index([employeeId, date])
@@index([courtId, date])
@@index([positionId])
@@index([shiftType])
```

### ScheduleWarning

```prisma
@@index([versionId])
@@index([scheduleId, date])
@@index([employeeId, date])
@@index([courtId, date])
@@index([positionId, date])
@@index([shiftType])
```

### FairnessRecord

```prisma
@@unique([employeeId, versionId])
@@index([versionId])
@@index([scheduleId])
```

### ScheduleChangeLog

```prisma
@@index([scheduleId, createdAt])
@@index([versionId, createdAt])
@@index([shiftAssignmentId])
@@index([changedById, createdAt])
```

## כללים שאינם נראים בקשרי ER

- מיגרציות SQL מוסיפות אינדקסים חלקיים: טיוטה אחת וגרסה מפורסמת נוכחית אחת לכל שיבוץ.
- `revision` משמש למניעת דריסת עריכה; `version` הוא מספר גרסת השיבוץ.
- `source` ו־`isLocked` מפרידים בין מקור האיוש לבין נעילה.
- טריגרים מגינים על גרסאות מפורסמות ועל היסטוריית השינויים.
- `UserCourtRole` הוא שיוך ללא שדה תפקיד; ההרשאות מסתמכות גם על `User.systemRole` ובדיקות שרת.
- `Capability` הוא enum ולא טבלה: GUARD < CONTROLLER < SHIFT_MANAGER.
- `SchedulePeriod.submissionState` מנהל הגשות בנפרד ממצב הפרסום. `Roster.status` נשמר לתאימות לתצוגה הקיימת.
- `ScheduleWarning.versionId` ו־`FairnessRecord.versionId` עדיין nullable בסכמה; תוצאות החישוב החדשות נכתבות לפי גרסה.

מקור: [schema.prisma](../prisma/schema.prisma), [תיעוד המימוש](scheduling-architecture.md).
