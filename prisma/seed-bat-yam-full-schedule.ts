import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import {
  PrismaClient,
  DayCategory,
  ScheduleVersionStatus,
  ShiftType,
} from '../src/generated/prisma/client';

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

const DEMO_PERIOD = {
  name: 'אוקטובר 2026 - שיבוץ דמו',
  startDate: '2026-09-27',
  endDate: '2026-10-10',
  submissionDeadline: '2026-09-28T20:00:00.000Z',
};

const SHIFT_TYPES = [ShiftType.MORNING, ShiftType.EVENING, ShiftType.NIGHT] as const;
const DAY_CATEGORIES = [DayCategory.WEEKDAY, DayCategory.FRIDAY, DayCategory.SATURDAY] as const;

/** תקנים עם כוח אדם נדרש — אחמ״ש, בקר, מאבטח */
const STAFFED_POSITION_CODES = [2, 3, 4] as const;

type EmployeeRef = { id: string; firstName: string; lastName: string };

function parseDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function eachDateInclusive(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const cur = parseDateOnly(startISO);
  const end = parseDateOnly(endISO);
  const cursor = new Date(cur);
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function dayCategoryForDate(iso: string): DayCategory {
  const [y, m, d] = iso.split('-').map(Number);
  const day = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  if (day === 5) return DayCategory.FRIDAY;
  if (day === 6) return DayCategory.SATURDAY;
  return DayCategory.WEEKDAY;
}

async function getStaffedPositions(facilityId: string) {
  const positions = await prisma.shiftRole.findMany({
    where: {
      facilityId,
      isActive: true,
      code: { in: [...STAFFED_POSITION_CODES] },
    },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

  if (positions.length !== STAFFED_POSITION_CODES.length) {
    throw new Error(
      `Expected positions ${STAFFED_POSITION_CODES.join(', ')} for court ${facilityId}. Run prisma/seed.ts first.`,
    );
  }

  return positions;
}

async function ensureShiftCapacities(facilityId: string, positions: Array<{ id: string; code: number }>) {
  let display = 0;

  for (const shiftType of SHIFT_TYPES) {
    for (const dayCategory of DAY_CATEGORIES) {
      for (const position of positions) {
        display += 1;
        const requiredCount = position.code === 4 ? 2 : 1;

        await prisma.staffingRequirement.upsert({
          where: {
            facilityId_shiftRoleId_shiftType_dayCategory: {
              facilityId,
              shiftRoleId: position.id,
              shiftType,
              dayCategory,
            },
          },
          create: {
            facilityId,
            shiftRoleId: position.id,
            shiftType,
            dayCategory,
            requiredCount,
            isActive: true,
            displayOrder: display,
          },
          update: { requiredCount, isActive: true, displayOrder: display },
        });
      }
    }
  }
}

function pickEmployeeForSlot(params: {
  positionName: string;
  byPositionName: Map<string, EmployeeRef[]>;
  rotation: number;
  usedEmployeeIds: Set<string>;
}): EmployeeRef {
  const { positionName, byPositionName, rotation, usedEmployeeIds } = params;
  const available = (pool: EmployeeRef[]) => pool.filter((employee) => !usedEmployeeIds.has(employee.id));

  const inPosition = available(byPositionName.get(positionName) ?? []);
  const choices = inPosition.length > 0 ? inPosition : available([...byPositionName.values()].flat());

  if (choices.length === 0) {
    throw new Error(`No available employee left for position ${positionName}`);
  }

  const employee = choices[rotation % choices.length]!;
  usedEmployeeIds.add(employee.id);
  return employee;
}

async function deleteExistingSchedules(facilityId: string, startDate: Date, endDate: Date) {
  const periods = await prisma.schedulePeriod.findMany({
    where: {
      facilityId,
      OR: [{ startDate, endDate }, { submissionState: 'OPEN' }],
    },
    select: { id: true },
  });

  if (periods.length === 0) return;

  throw new Error('Demo requires unused dates; schedule history cannot be deleted by seed.');
}

export async function seedBatYamFullSchedule() {
  const court = await prisma.facility.findUnique({
    where: { code: COURT_CODE },
    select: { id: true, name: true, code: true },
  });

  if (!court) {
    throw new Error(`Court ${COURT_CODE} not found. Run prisma/seed.ts first.`);
  }

  const positions = await getStaffedPositions(court.id);
  await ensureShiftCapacities(court.id, positions);

  const manager = await prisma.user.findFirst({
    where: {
      facilityRoles: { some: { role: 'MANAGER' } },
      employee: { facilityId: court.id },
    },
    select: { id: true, email: true },
  });

  if (!manager) {
    throw new Error(`Manager user not found for court: ${court.name}`);
  }

  const startDate = parseDateOnly(DEMO_PERIOD.startDate);
  const endDate = parseDateOnly(DEMO_PERIOD.endDate);

  await deleteExistingSchedules(court.id, startDate, endDate);

  const period = await prisma.schedulePeriod.create({
    data: {
      facilityId: court.id,
      name: DEMO_PERIOD.name,
      startDate,
      endDate,
      submissionDeadline: new Date(DEMO_PERIOD.submissionDeadline),
    },
  });

  const schedule = await prisma.roster.create({
    data: {
      id: period.id,
      facilityId: court.id,
      periodId: period.id,
      createdById: manager.id,
    },
  });

  const version = await prisma.rosterVersion.create({
    data: {
      scheduleId: schedule.id,
      facilityId: court.id,
      version: 1,
      status: ScheduleVersionStatus.DRAFT,
      isActive: false,
      createdById: manager.id,
    },
  });

  const employees = await prisma.employee.findMany({
    where: { facilityId: court.id, isActive: true },
    include: { primaryShiftRole: { select: { name: true } } },
  });

  if (employees.length === 0) {
    throw new Error(`No active employees found for ${court.name}. Run prisma/seed.ts first.`);
  }

  const byPositionName = new Map<string, EmployeeRef[]>();
  for (const employee of employees) {
    const name = employee.primaryShiftRole.name;
    const list = byPositionName.get(name) ?? [];
    list.push({ id: employee.id, firstName: employee.firstName, lastName: employee.lastName });
    byPositionName.set(name, list);
  }

  const capacityRows = await prisma.staffingRequirement.findMany({
    where: { facilityId: court.id, isActive: true },
    select: { shiftRoleId: true, shiftType: true, dayCategory: true, requiredCount: true },
  });

  const capKey = (positionId: string, shiftType: ShiftType, dayCategory: DayCategory) =>
    `${positionId}|${shiftType}|${dayCategory}`;

  const capMap = new Map<string, number>();
  for (const row of capacityRows) {
    capMap.set(capKey(row.shiftRoleId, row.shiftType, row.dayCategory), row.requiredCount);
  }

  const dates = eachDateInclusive(DEMO_PERIOD.startDate, DEMO_PERIOD.endDate);
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
    const date = parseDateOnly(iso);

    for (const shiftType of SHIFT_TYPES) {
      const usedEmployeeIds = new Set<string>();

      for (const { id: positionId, name: positionName } of positions) {
        const amount = capMap.get(capKey(positionId, shiftType, dayCategory)) ?? 0;
        for (let slotIndex = 0; slotIndex < amount; slotIndex += 1) {
          const employee = pickEmployeeForSlot({
            positionName,
            byPositionName,
            rotation: rotation++,
            usedEmployeeIds,
          });
          assignmentRows.push({
            scheduleId: schedule.id,
            versionId: version.id,
            employeeId: employee.id,
            facilityId: court.id,
            shiftRoleId: positionId,
            date,
            shiftType,
          });
        }
      }
    }
  }

  for (const batch of chunk(assignmentRows, 200)) {
    await prisma.shiftAssignment.createMany({ data: batch });
  }

  return {
    court,
    scheduleId: schedule.id,
    assignmentCount: assignmentRows.length,
    periodRange: { start: DEMO_PERIOD.startDate, end: DEMO_PERIOD.endDate },
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

seedBatYamFullSchedule()
  .then((result) => {
    console.log('✅ Bat Yam full schedule seeded');
    console.log(result);
  })
  .catch(async (err) => {
    console.error('❌ seedBatYamFullSchedule failed');
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
