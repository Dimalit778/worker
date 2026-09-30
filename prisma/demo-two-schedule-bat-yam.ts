import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import {
  PrismaClient,
  DayCategory,
  ScheduleVersionStatus,
  ShiftType,
} from '../src/generated/prisma/client';

/**
 * שני שיבוצי דמו לבית משפט בת ים.
 *
 * ברירת מחדל:
 *   2026-09-06 → 2026-09-26  תקופה שנגמרה (ARCHIVED / בארכיון)
 *   2026-09-27 → 2026-10-10  תקופה שמכסה את היום (PUBLISHED / פעיל)
 *
 * הסטטוס נקבע לפי היום בישראל: תקופה שתאריך הסיום שלה עבר → בארכיון, אחרת פעיל.
 *
 * להחליף תאריכים, ערכו את DEFAULT_PERIODS או הריצו:
 *   pnpm db:seed:demo-bat-yam -- 2026-09-06 2026-09-26 2026-09-27 2026-10-10
 */

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const COURT_CODE = 'BAT_YAM';
const FACILITY_OFFICER_CODE = 1;
const DEMO_NAME_PREFIX = 'דמו בת ים';
const TIME_ZONE = 'Asia/Jerusalem';
const SHIFT_TYPES = [ShiftType.MORNING, ShiftType.EVENING, ShiftType.NIGHT] as const;

type PeriodInput = {
  startDate: string;
  endDate: string;
};

const DEFAULT_PERIODS: PeriodInput[] = [
  { startDate: '2026-09-06', endDate: '2026-09-26' },
  { startDate: '2026-09-27', endDate: '2026-10-10' },
];

type EmployeeRef = {
  id: string;
  positionId: string;
  positionName: string;
};

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function assertIsoDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`תאריך לא תקין "${value}". השתמשו בפורמט YYYY-MM-DD.`);
  }
  const [y, m, d] = value.split('-').map(Number);
  const date = parseDateOnly(value);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m! - 1 || date.getUTCDate() !== d) {
    throw new Error(`תאריך לא תקין "${value}".`);
  }
}

function todayIso(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((part) => part.type === 'year')?.value;
  const m = parts.find((part) => part.type === 'month')?.value;
  const d = parts.find((part) => part.type === 'day')?.value;
  if (!y || !m || !d) throw new Error('לא ניתן לחשב את התאריך של היום');
  return `${y}-${m}-${d}`;
}

function eachDateInclusive(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const cursor = parseDateOnly(startISO);
  const end = parseDateOnly(endISO);
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function dayCategoryForDate(iso: string): DayCategory {
  const day = parseDateOnly(iso).getUTCDay();
  if (day === 5) return DayCategory.FRIDAY;
  if (day === 6) return DayCategory.SATURDAY;
  return DayCategory.WEEKDAY;
}

function addDaysIso(iso: string, days: number): string {
  const date = parseDateOnly(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function readPeriods(): PeriodInput[] {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const periods = args.length === 0 ? DEFAULT_PERIODS : toPeriodPair(args);
  if (periods.length !== 2) {
    throw new Error('נדרשות שתי תקופות: start1 end1 start2 end2');
  }

  for (const period of periods) {
    assertIsoDate(period.startDate);
    assertIsoDate(period.endDate);
    if (period.startDate > period.endDate) {
      throw new Error(`תאריך ההתחלה ${period.startDate} אחרי תאריך הסיום ${period.endDate}`);
    }
  }

  const [first, second] = periods;
  if (first!.startDate <= second!.endDate && second!.startDate <= first!.endDate) {
    throw new Error('שתי התקופות חופפות. בחרו טווחים נפרדים.');
  }

  return periods;
}

function toPeriodPair(args: string[]): PeriodInput[] {
  if (args.length !== 4) {
    throw new Error(
      'העבירו 4 תאריכים: תחילת תקופה 1, סוף תקופה 1, תחילת תקופה 2, סוף תקופה 2. לדוגמה: 2026-09-06 2026-09-26 2026-09-27 2026-10-10',
    );
  }
  return [
    { startDate: args[0]!, endDate: args[1]! },
    { startDate: args[2]!, endDate: args[3]! },
  ];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function pickEmployeeForSlot(params: {
  positionId: string;
  byPositionId: Map<string, EmployeeRef[]>;
  eligibleIds: Set<string>;
  rotation: number;
  usedEmployeeIds: Set<string>;
}): EmployeeRef {
  const available = (pool: EmployeeRef[]) =>
    pool.filter((employee) => params.eligibleIds.has(employee.id) && !params.usedEmployeeIds.has(employee.id));

  const inPosition = available(params.byPositionId.get(params.positionId) ?? []);
  const choices = inPosition.length > 0 ? inPosition : available([...params.byPositionId.values()].flat());
  if (choices.length === 0) {
    throw new Error('לא נשאר עובד פנוי שהגיש את המשמרת הזו');
  }

  const employee = choices[params.rotation % choices.length]!;
  params.usedEmployeeIds.add(employee.id);
  return employee;
}

async function deletePreviousDemo(facilityId: string, periods: PeriodInput[]) {
  const result = await prisma.schedulePeriod.count({
    where: {
      facilityId,
      OR: [
        { name: { startsWith: DEMO_NAME_PREFIX } },
        ...periods.map((period) => ({
          startDate: { lte: parseDateOnly(period.endDate) },
          endDate: { gte: parseDateOnly(period.startDate) },
        })),
      ],
    },
  });
  if (result) throw new Error('Demo requires unused dates in an empty development database; published history is retained.');
  return 0;
}

async function seedPeriod(params: {
  facilityId: string;
  createdById: string;
  period: PeriodInput;
  today: string;
  employees: EmployeeRef[];
  byPositionId: Map<string, EmployeeRef[]>;
  capMap: Map<string, number>;
}) {
  const { facilityId, createdById, period, today, employees, byPositionId, capMap } = params;
  const ended = period.endDate < today;
  const scheduleStatus = ended ? 'ARCHIVED' : 'PUBLISHED';
  const versionStatus = ScheduleVersionStatus.PUBLISHED;
  const label = ended ? 'שיבוץ שהסתיים' : 'שיבוץ פעיל';
  const dates = eachDateInclusive(period.startDate, period.endDate);
  const deadline = new Date(`${addDaysIso(period.startDate, -1)}T20:00:00.000Z`);
  const submittedAt = new Date(`${addDaysIso(period.startDate, -2)}T20:00:00.000Z`);

  const created = await prisma.schedulePeriod.create({
    data: {
      facilityId,
      submissionState: 'CLOSED',
      name: `${DEMO_NAME_PREFIX} — ${label}`,
      startDate: parseDateOnly(period.startDate),
      endDate: parseDateOnly(period.endDate),
      submissionOpensAt: new Date(`${addDaysIso(period.startDate, -14)}T06:00:00.000Z`),
      submissionDeadline: deadline,
      submissionNotifiedAt: submittedAt,
      submissionWindowManaged: false,
    },
    select: { id: true },
  });

  await prisma.availabilitySubmission.createMany({
    data: employees.map((employee) => ({
      periodId: created.id,
      employeeId: employee.id,
      isSubmitted: true,
      submittedAt,
    })),
  });

  const forms = await prisma.availabilitySubmission.findMany({
    where: { periodId: created.id },
    select: { id: true, employeeId: true },
  });

  const submittedKey = (employeeId: string, iso: string, shiftType: ShiftType) =>
    `${employeeId}|${iso}|${shiftType}`;
  const submitted = new Set<string>();
  const shiftRows: Array<{ formId: string; date: Date; shiftType: ShiftType }> = [];

  for (const form of forms) {
    for (const iso of dates) {
      for (const shiftType of SHIFT_TYPES) {
        submitted.add(submittedKey(form.employeeId, iso, shiftType));
        shiftRows.push({ formId: form.id, date: parseDateOnly(iso), shiftType });
      }
    }
  }

  for (const batch of chunk(shiftRows, 500)) {
    await prisma.shiftAvailability.createMany({ data: batch });
  }

  const schedule = await prisma.roster.create({
    data: {
      facilityId,
      periodId: created.id,
      archivedAt: ended ? deadline : null,
      createdById,
    },
    select: { id: true },
  });

  const version = await prisma.rosterVersion.create({
    data: {
      scheduleId: schedule.id,
      facilityId,
      version: 1,
      status: ScheduleVersionStatus.DRAFT,
      isActive: false,
      createdById,
    },
    select: { id: true },
  });

  const assignmentRows: Array<{
    scheduleId: string;
    versionId: string;
    employeeId: string;
    facilityId: string;
    shiftRoleId: string;
    date: Date;
    shiftType: ShiftType;
  }> = [];

  let rotation = 0;
  for (const iso of dates) {
    const dayCategory = dayCategoryForDate(iso);
    for (const shiftType of SHIFT_TYPES) {
      const usedEmployeeIds = new Set<string>();
      const eligibleIds = new Set(
        employees
          .filter((employee) => submitted.has(submittedKey(employee.id, iso, shiftType)))
          .map((employee) => employee.id),
      );

      for (const [key, amount] of capMap) {
        const [positionId, keyShift, keyDay] = key.split('|');
        if (!positionId || keyShift !== shiftType || keyDay !== dayCategory || amount <= 0) continue;
        for (let slot = 0; slot < amount; slot += 1) {
          const employee = pickEmployeeForSlot({
            positionId,
            byPositionId,
            eligibleIds,
            rotation: rotation++,
            usedEmployeeIds,
          });
          assignmentRows.push({
            scheduleId: schedule.id,
            versionId: version.id,
            employeeId: employee.id,
            facilityId,
            shiftRoleId: positionId,
            date: parseDateOnly(iso),
            shiftType,
          });
        }
      }
    }
  }

  for (const batch of chunk(assignmentRows, 200)) {
    await prisma.shiftAssignment.createMany({ data: batch });
  }

  await prisma.rosterVersion.update({ where: { id: version.id }, data: { status: versionStatus, isActive: true, publishedAt: deadline } });

  return {
    name: `${DEMO_NAME_PREFIX} — ${label}`,
    status: scheduleStatus,
    startDate: period.startDate,
    endDate: period.endDate,
    submissions: forms.length,
    shiftAvailabilitys: shiftRows.length,
    assignments: assignmentRows.length,
  };
}

async function main() {
  const periods = readPeriods();
  const today = todayIso();

  const court = await prisma.facility.findUnique({
    where: { code: COURT_CODE },
    select: { id: true, name: true },
  });
  if (!court) throw new Error(`Court ${COURT_CODE} not found. Run prisma/seed.ts first.`);

  const manager = await prisma.user.findFirst({
    where: { facilityRoles: { some: { facilityId: court.id, role: 'MANAGER' } } },
    select: { id: true },
  });
  if (!manager) throw new Error(`Manager user not found for ${court.name}`);

  const positions = await prisma.shiftRole.findMany({
    where: { facilityId: court.id, isActive: true, code: { not: FACILITY_OFFICER_CODE } },
    select: { id: true, code: true, name: true },
  });
  if (positions.length === 0) {
    throw new Error('לא נמצאו תפקידים פעילים מלבד קצין מתקן. הריצו prisma/seed.ts קודם.');
  }

  const employees = await prisma.employee.findMany({
    where: { facilityId: court.id, isActive: true, primaryShiftRole: { code: { not: FACILITY_OFFICER_CODE } } },
    select: {
      id: true,
      primaryShiftRoleId: true,
      primaryShiftRole: { select: { name: true } },
    },
    orderBy: [{ primaryShiftRole: { code: 'asc' } }, { id: 'asc' }],
  });
  if (employees.length === 0) {
    throw new Error(`אין עובדים פעילים מלבד קצין מתקן ב${court.name}`);
  }

  const employeeRefs: EmployeeRef[] = employees.map((employee) => ({
    id: employee.id,
    positionId: employee.primaryShiftRoleId,
    positionName: employee.primaryShiftRole.name,
  }));
  const byPositionId = new Map<string, EmployeeRef[]>();
  for (const employee of employeeRefs) {
    const list = byPositionId.get(employee.positionId) ?? [];
    list.push(employee);
    byPositionId.set(employee.positionId, list);
  }

  const capacityRows = await prisma.staffingRequirement.findMany({
    where: {
      facilityId: court.id,
      isActive: true,
      shiftRole: { code: { not: FACILITY_OFFICER_CODE } },
    },
    select: { shiftRoleId: true, shiftType: true, dayCategory: true, requiredCount: true },
  });
  if (capacityRows.length === 0) {
    throw new Error('אין תקני משמרת לבית המשפט. הריצו prisma/seed.ts קודם.');
  }

  const capMap = new Map<string, number>();
  for (const row of capacityRows) {
    capMap.set(`${row.shiftRoleId}|${row.shiftType}|${row.dayCategory}`, row.requiredCount);
  }

  const removed = await deletePreviousDemo(court.id, periods);
  const results = [];
  for (const period of periods) {
    results.push(
      await seedPeriod({
        facilityId: court.id,
        createdById: manager.id,
        period,
        today,
        employees: employeeRefs,
        byPositionId,
        capMap,
      }),
    );
  }

  console.log(`✅ ${court.name}: נוצרו 2 שיבוצי דמו (נמחקו ${removed} תקופות קודמות חופפות)`);
  console.log({ today, results });
}

main()
  .catch((error) => {
    console.error('❌ demo-two-schedule-bat-yam failed');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
