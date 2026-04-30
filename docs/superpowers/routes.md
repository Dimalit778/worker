# תכנון Routes, מסכים ו-Queries

מסמך זה מרכז את מבנה המסכים המומלץ למערכת השיבוצים, לפי סוג משתמש.

המטרה היא להפריד בצורה ברורה בין שלושה דברים שונים:

1. **שיבוץ פעיל** - השיבוץ שעובדים לפיו עכשיו.
2. **תקופת שיבוץ פתוחה להגשה** - תקופה שבה העובדים ממלאים זמינות.
3. **שיבוץ עתידי / בהכנה** - השיבוץ שהמערכת או המנהל מכינים לתקופה הבאה.

---

## עקרונות

- לכל עמוד צריך להיות query ראשי אחד שמחזיר בדיוק את המידע שהעמוד צריך.
- עובד רואה מסכים פשוטים וקצרים.
- מנהל רואה מסכי עבודה שמפרידים בין מעקב, עריכה, הגדרות ודוחות.
- לא להשתמש ב-`OPEN_FOR_SUBMISSION` כדי לזהות שיבוץ פעיל. זה סטטוס של תקופת הגשה, לא של שיבוץ עבודה.

---

## Routes לעובד

| Route                          | שם במסך     | מה מציגים                                         | Query מומלץ                                            |
| ------------------------------ | ----------- | ------------------------------------------------- | ------------------------------------------------------ |
| `/user`                        | השיבוץ שלי  | השיבוץ הפעיל הנוכחי, עם הדגשה של המשמרות של העובד | `getEmployeeCurrentSchedule(employeeId, courtId)`      |
| `/user/availability`           | הגשת זמינות | תקופה פתוחה להגשה, לוח סימון משמרות, סטטוס הגשה   | `getScheduleData()`                                    |
| `/user/submissions`            | ההגשות שלי  | כל ההגשות של העובד לפי תקופות שיבוץ               | `getEmployeeAvailability(employeeId)`                  |
| `/user/submissions/[periodId]` | הגשה לתקופה | ההגשה של העובד לתקופה ספציפית                     | `getEmployeeSubmissionForPeriod(employeeId, periodId)` |

### `/user` - השיבוץ שלי

מטרת העמוד: העובד נכנס ורואה במה הוא משובץ עכשיו.

להציג:

- שם תקופת השיבוץ.
- טווח תאריכים.
- טבלת משמרות.
- הדגשה ברורה של המשמרות של העובד המחובר.
- מצב ריק אם אין שיבוץ פעיל.

Query:

```ts
async function getEmployeeCurrentSchedule(employeeId: string, courtId: string) {
  const today = new Date();

  return prisma.schedule.findFirst({
    where: {
      status: 'PUBLISHED',
      period: {
        courtId,
        startDate: { lte: today },
        endDate: { gte: today },
      },
    },
    include: {
      period: true,
      assignments: {
        include: {
          employee: true,
          position: true,
        },
        orderBy: [{ date: 'asc' }, { shiftType: 'asc' }, { slotIndex: 'asc' }],
      },
    },
  });
}
```

ה-payload שהעמוד צריך לקבל:

```ts
{
  period,
  assignments,
  myAssignments,
}
```

---

### `/user/availability` - הגשת זמינות

מטרת העמוד: העובד ממלא אילו משמרות הוא יכול לעבוד בתקופה פתוחה.

להציג:

- שם תקופת השיבוץ הפתוחה.
- תאריכי התחלה וסיום.
- לוח משמרות לסימון.
- כפתור שליחה.
- סטטוס אם כבר הוגש.
- מצב ריק אם אין תקופה פתוחה.

Query קיים:

```ts
getScheduleData();
```

ה-query הזה כבר מביא:

```ts
{
  period,
  entries,
  isSubmitted,
}
```

---

### `/user/submissions` - ההגשות שלי

מטרת העמוד: העובד רואה את כל ההגשות שלו לאורך התקופות.

להציג:

- רשימת תקופות.
- סטטוס תקופה.
- האם הוגש.
- כמה משמרות סומנו.
- כניסה לצפייה בהגשה ספציפית.

Query קיים:

```ts
getEmployeeAvailability(employeeId);
```

---

### `/user/submissions/[periodId]` - הגשה לתקופה

מטרת העמוד: צפייה מפורטת בהגשה אחת.

להציג:

- פרטי התקופה.
- לוח המשמרות שהעובד סימן.
- סטטוס הגשה.
- תאריך הגשה אם קיים.

Query:

```ts
async function getEmployeeSubmissionForPeriod(employeeId: string, periodId: string) {
  return prisma.availability.findUnique({
    where: {
      periodId_employeeId: {
        periodId,
        employeeId,
      },
    },
    include: {
      period: true,
      entries: {
        orderBy: [{ date: 'asc' }, { shiftType: 'asc' }],
      },
    },
  });
}
```

---

## Routes למנהל

| Route                                                  | שם במסך        | מה מציגים                                                 | Query מומלץ                                                      |
| ------------------------------------------------------ | -------------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| `/manager`                                             | לוח בקרה       | תקציר מצב: שיבוץ פעיל, תקופה פתוחה, הגשות, חוסרים, עובדים | `getManagerDashboard(courtId)`                                   |
| `/manager/schedule`                                    | שיבוץ פעיל     | השיבוץ הנוכחי הפעיל, כולל עריכה ידנית                     | `getManagerActiveSchedule(courtId)`                              |
| `/manager/future-schedule`                             | שיבוץ עתידי    | שיבוץ בהכנה או שיבוץ עתידי שפורסם                         | `getManagerFutureSchedule(courtId)`                              |
| `/manager/future-schedule/warnings`                    | שגיאות וחוסרים | רשימת בעיות בשיבוץ העתידי                                 | `getScheduleWarnings(scheduleId)`                                |
| `/manager/future-schedule/fairness`                    | הוגנות         | טבלת הוגנות לפי עובדים                                    | `getScheduleFairness(periodId)`                                  |
| `/manager/periods`                                     | תקופות שיבוץ   | כל התקופות, יצירת תקופה, שינוי סטטוס                      | `getPeriodsForManager()`                                         |
| `/manager/periods/[periodId]`                          | פרטי תקופה     | פרטי תקופה, סטטוס, דדליין, כמות הגשות                     | `getPeriodDetails(periodId, courtId)`                            |
| `/manager/periods/[periodId]/submissions`              | הגשות עובדים   | מי הגיש ומי לא הגיש לתקופה                                | `getPeriodSubmissions(periodId, courtId)`                        |
| `/manager/periods/[periodId]/submissions/[employeeId]` | הגשת עובד      | ההגשה של עובד ספציפי בתקופה                               | `getEmployeeSubmissionForManager(periodId, employeeId, courtId)` |
| `/manager/employees`                                   | עובדים         | רשימת עובדים, הוספה, עריכה, מחיקה/השבתה                   | `getEmployees()` + `getPositions()`                              |
| `/manager/employees/[employeeId]`                      | פרופיל עובד    | פרטי עובד, תפקיד, סטטיסטיקות בסיסיות                      | `getEmployeeProfile(employeeId, courtId)`                        |
| `/manager/employees/[employeeId]/submissions`          | הגשות עובד     | כל ההגשות של עובד בכל התקופות                             | `getEmployeeSubmissionsForManager(employeeId, courtId)`          |
| `/manager/settings`                                    | הגדרות         | תקנים ותפקידים                                            | `getPositions(courtId)` + `getShiftCapacities(courtId)`          |

---

## פירוט עמודי מנהל

### `/manager` - לוח בקרה

מטרת העמוד: לתת למנהל תמונת מצב מהירה ולהפנות אותו לפעולה הבאה.

להציג:

- האם יש שיבוץ פעיל עכשיו.
- האם יש תקופה פתוחה להגשות.
- כמה עובדים הגישו מתוך כמה.
- האם יש שיבוץ עתידי בהכנה.
- כמה שגיאות/חוסרים קיימים.
- כמות עובדים פעילים.
- קיצורי דרך: יצירת תקופה, צפייה בהגשות, עריכת שיבוץ עתידי.

Query:

```ts
async function getManagerDashboard(courtId: string) {
  const today = new Date();

  const [activeSchedule, openPeriod, futureSchedule, employeesCount] = await Promise.all([
    prisma.schedule.findFirst({
      where: {
        status: 'PUBLISHED',
        period: {
          courtId,
          startDate: { lte: today },
          endDate: { gte: today },
        },
      },
      include: { period: true },
    }),

    prisma.schedulePeriod.findFirst({
      where: {
        courtId,
        status: 'OPEN_FOR_SUBMISSION',
      },
      include: {
        _count: {
          select: {
            availabilities: { where: { isSubmitted: true } },
          },
        },
      },
    }),

    prisma.schedule.findFirst({
      where: {
        period: {
          courtId,
          startDate: { gt: today },
        },
        status: { in: ['DRAFT', 'FINALIZED', 'PUBLISHED'] },
      },
      include: {
        period: true,
        _count: { select: { warnings: true } },
      },
      orderBy: {
        period: { startDate: 'asc' },
      },
    }),

    prisma.employee.count({
      where: { courtId, isActive: true },
    }),
  ]);

  return {
    activeSchedule,
    openPeriod,
    futureSchedule,
    employeesCount,
  };
}
```

---

### `/manager/schedule` - שיבוץ פעיל

מטרת העמוד: ניהול השיבוץ שעובדים לפיו עכשיו.

להציג:

- שם תקופת השיבוץ.
- טווח תאריכים.
- טבלת שיבוץ מלאה.
- עובדים משובצים בכל משמרת.
- יכולת עריכה ידנית.
- סימון משמרות שנערכו ידנית.
- חוסרים או בעיות אם קיימים.

Query:

```ts
async function getManagerActiveSchedule(courtId: string) {
  const today = new Date();

  return prisma.schedule.findFirst({
    where: {
      status: 'PUBLISHED',
      period: {
        courtId,
        startDate: { lte: today },
        endDate: { gte: today },
      },
    },
    include: {
      period: true,
      assignments: {
        include: {
          employee: true,
          position: true,
        },
        orderBy: [{ date: 'asc' }, { shiftType: 'asc' }, { slotIndex: 'asc' }],
      },
      warnings: true,
    },
  });
}
```

---

### `/manager/future-schedule` - שיבוץ עתידי

מטרת העמוד: עבודה על השיבוץ הבא לפני שהוא הופך לשיבוץ פעיל.

להציג:

- שם התקופה העתידית.
- סטטוס השיבוץ: טיוטה, סופי, פורסם.
- טבלת שיבוץ מלאה.
- עובדים זמינים לפי ההגשות.
- תקנים לפי תפקיד ומשמרת.
- עריכה ידנית.
- כפתור פרסום.
- קישורים לשגיאות, הגשות והוגנות.

Query:

```ts
async function getManagerFutureSchedule(courtId: string) {
  const today = new Date();

  const schedule = await prisma.schedule.findFirst({
    where: {
      period: {
        courtId,
        startDate: { gt: today },
      },
      status: { in: ['DRAFT', 'FINALIZED', 'PUBLISHED'] },
    },
    include: {
      period: true,
      assignments: {
        include: {
          employee: true,
          position: true,
        },
        orderBy: [{ date: 'asc' }, { shiftType: 'asc' }, { slotIndex: 'asc' }],
      },
      warnings: true,
    },
    orderBy: {
      period: { startDate: 'asc' },
    },
  });

  if (!schedule) return null;

  const [employees, capacity, availabilities] = await Promise.all([
    prisma.employee.findMany({
      where: { courtId, isActive: true },
      include: { position: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),

    prisma.shiftCapacity.findMany({
      where: { courtId, isActive: true },
      include: { position: true },
      orderBy: [{ shiftType: 'asc' }, { position: { displayOrder: 'asc' } }, { dayCategory: 'asc' }],
    }),

    prisma.availability.findMany({
      where: { periodId: schedule.periodId },
      include: {
        employee: true,
        entries: true,
      },
    }),
  ]);

  return {
    schedule,
    employees,
    capacity,
    availabilities,
  };
}
```

---

### `/manager/future-schedule/warnings` - שגיאות וחוסרים

מטרת העמוד: להבין מה לא תקין בשיבוץ העתידי.

להציג:

- רשימת שגיאות.
- חומרה: שגיאה / אזהרה / מידע.
- תאריך.
- סוג משמרת.
- תפקיד.
- עובד, אם רלוונטי.
- הודעה ברורה.

Query:

```ts
async function getScheduleWarnings(scheduleId: string) {
  return prisma.scheduleWarning.findMany({
    where: { scheduleId },
    include: {
      employee: true,
      position: true,
    },
    orderBy: [{ severity: 'asc' }, { date: 'asc' }],
  });
}
```

---

### `/manager/future-schedule/fairness` - הוגנות

מטרת העמוד: לעקוב האם חלוקת המשמרות מאוזנת בין העובדים.

להציג:

- עובד.
- תפקיד.
- סה"כ משמרות.
- משמרות בוקר.
- משמרות ערב.
- משמרות לילה.
- משמרות סוף שבוע.
- אינדיקציה לעובדים שקיבלו הרבה או מעט ביחס לאחרים.

Query:

```ts
async function getScheduleFairness(periodId: string) {
  return prisma.fairnessRecord.findMany({
    where: { periodId },
    include: {
      employee: {
        include: { position: true },
      },
    },
    orderBy: { totalShifts: 'desc' },
  });
}
```

---

### `/manager/periods` - תקופות שיבוץ

מטרת העמוד: ניהול כל תקופות השיבוץ.

להציג:

- רשימת כל התקופות.
- סטטוס כל תקופה.
- תאריכי התחלה וסיום.
- דדליין להגשה.
- כמה עובדים הגישו.
- כפתור יצירת תקופה חדשה.
- פעולות: פתיחה להגשה, נעילה, מחיקה, יצירת שיבוץ.

Query קיים:

```ts
getPeriodsForManager();
```

חשוב לוודא שה-query מסנן לפי `courtId` של המנהל.

---

### `/manager/periods/[periodId]` - פרטי תקופה

מטרת העמוד: עמוד מרכזי לתקופה אחת.

להציג:

- שם תקופה.
- תאריכים.
- דדליין להגשה.
- סטטוס.
- כמה עובדים הגישו מתוך כמה.
- האם יש שיבוץ שנוצר לתקופה.
- פעולות אפשריות לפי סטטוס.

Query:

```ts
async function getPeriodDetails(periodId: string, courtId: string) {
  return prisma.schedulePeriod.findFirst({
    where: { id: periodId, courtId },
    include: {
      schedule: {
        include: {
          _count: {
            select: {
              assignments: true,
              warnings: true,
            },
          },
        },
      },
      _count: {
        select: {
          availabilities: { where: { isSubmitted: true } },
        },
      },
    },
  });
}
```

---

### `/manager/periods/[periodId]/submissions` - הגשות עובדים

מטרת העמוד: לראות מי הגיש ומי לא.

להציג:

- רשימת עובדים.
- תפקיד.
- האם הגיש.
- תאריך הגשה.
- כמות משמרות שסומנו.
- כפתור צפייה בהגשה.

Query:

```ts
async function getPeriodSubmissions(periodId: string, courtId: string) {
  return prisma.employee.findMany({
    where: { courtId, isActive: true },
    include: {
      position: true,
      availabilities: {
        where: { periodId },
        include: { entries: true },
      },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
}
```

---

### `/manager/periods/[periodId]/submissions/[employeeId]` - הגשת עובד

מטרת העמוד: צפייה בהגשה של עובד אחד בתקופה מסוימת.

להציג:

- פרטי העובד.
- פרטי התקופה.
- האם הוגש.
- תאריך הגשה.
- לוח המשמרות שסומנו.

Query:

```ts
async function getEmployeeSubmissionForManager(periodId: string, employeeId: string, courtId: string) {
  return prisma.availability.findFirst({
    where: {
      periodId,
      employeeId,
      employee: { courtId },
    },
    include: {
      period: true,
      employee: {
        include: { position: true },
      },
      entries: {
        orderBy: [{ date: 'asc' }, { shiftType: 'asc' }],
      },
    },
  });
}
```

---

### `/manager/employees` - עובדים

מטרת העמוד: ניהול העובדים בבית המשפט.

להציג:

- טבלת עובדים.
- שם.
- אימייל.
- טלפון.
- תפקיד.
- סטטוס פעיל/לא פעיל.
- פעולות: הוספה, עריכה, מחיקה/השבתה.

Queries קיימים:

```ts
getEmployees();
getPositions();
```

---

### `/manager/employees/[employeeId]` - פרופיל עובד

מטרת העמוד: לראות מידע על עובד אחד.

להציג:

- שם מלא.
- אימייל.
- טלפון.
- תפקיד.
- סטטוס פעיל.
- כמות הגשות.
- כמות שיבוצים.
- קישור לכל ההגשות.

Query:

```ts
async function getEmployeeProfile(employeeId: string, courtId: string) {
  return prisma.employee.findFirst({
    where: { id: employeeId, courtId },
    include: {
      user: { select: { email: true } },
      position: true,
      _count: {
        select: {
          availabilities: true,
          assignments: true,
        },
      },
    },
  });
}
```

---

### `/manager/employees/[employeeId]/submissions` - הגשות עובד

מטרת העמוד: לראות את כל ההגשות של עובד אחד בכל התקופות.

להציג:

- רשימת תקופות.
- סטטוס תקופה.
- האם הוגש.
- תאריך הגשה.
- כמה משמרות סומנו.
- כניסה להגשה ספציפית.

Query:

```ts
async function getEmployeeSubmissionsForManager(employeeId: string, courtId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, courtId },
    select: { id: true },
  });

  if (!employee) return null;

  return prisma.availability.findMany({
    where: { employeeId },
    include: {
      period: true,
      entries: true,
    },
    orderBy: {
      period: { startDate: 'desc' },
    },
  });
}
```

---

### `/manager/settings` - הגדרות

מטרת העמוד: הגדרות בית משפט שמשפיעות על יצירת השיבוץ.

להציג:

- תפקידים בבית המשפט.
- הוספת תפקיד.
- עריכת/השבתת תפקיד.
- סדר תפקידים.
- תקנים לכל משמרת לפי:
  - סוג יום.
  - סוג משמרת.
  - תפקיד.
  - כמות נדרשת.

Queries קיימים:

```ts
getPositions(courtId);
getShiftCapacities(courtId);
```

---

## התאמות מומלצות לקוד הקיים

### שינוי שמות בתפריט

המצב הקיים:

```ts
[
  { href: '/manager', label: 'לוח בקרה' },
  { href: '/manager/draft', label: 'בהכנה' },
  { href: '/manager/schedule', label: 'שיבוץ עבודה' },
  { href: '/manager/periods', label: 'תקופות' },
  { href: '/manager/guards', label: 'מאבטחים' },
  { href: '/manager/settings', label: 'הגדרות' },
];
```

מומלץ:

```ts
[
  { href: '/manager', label: 'לוח בקרה' },
  { href: '/manager/schedule', label: 'שיבוץ פעיל' },
  { href: '/manager/future-schedule', label: 'שיבוץ עתידי' },
  { href: '/manager/periods', label: 'תקופות שיבוץ' },
  { href: '/manager/employees', label: 'עובדים' },
  { href: '/manager/settings', label: 'הגדרות' },
];
```

### שינוי Routes קיימים

אפשר לעשות את זה בהדרגה:

| קיים היום         | מומלץ                      |
| ----------------- | -------------------------- |
| `/manager/draft`  | `/manager/future-schedule` |
| `/manager/guards` | `/manager/employees`       |
| `/user/history`   | `/user/submissions`        |

אפשר גם להשאיר redirect מהנתיבים הישנים לחדשים כדי לא לשבור קישורים קיימים.

---

## תיקון חשוב בלוגיקת שיבוץ פעיל

כרגע יש קוד שמביא שיבוץ לפי תקופה בסטטוס:

```ts
status: PeriodStatus.OPEN_FOR_SUBMISSION;
```

זה מתאים להגשת זמינות, לא לשיבוץ פעיל.

שיבוץ פעיל צריך להימצא לפי:

```ts
schedule.status = PUBLISHED;
period.startDate <= today;
period.endDate >= today;
```

שיבוץ עתידי צריך להימצא לפי:

```ts
period.startDate > today;
schedule.status in DRAFT / FINALIZED / PUBLISHED;
```

תקופת הגשה פתוחה צריכה להימצא לפי:

```ts
period.status = OPEN_FOR_SUBMISSION;
```

---

## סדר מימוש מומלץ

1. לתקן את ההפרדה בין שיבוץ פעיל, שיבוץ עתידי ותקופת הגשה.
2. לשנות שמות בתפריטים בלי לשנות עדיין מבנה DB.
3. להוסיף queries חסרים ב-`src/features/.../queries.ts`.
4. להוסיף routes חדשים עם redirect מהישנים.
5. להוסיף עמודי משנה להגשות, שגיאות והוגנות.
6. לשפר את לוח הבקרה כך שיכוון את המנהל לפעולה הבאה.
