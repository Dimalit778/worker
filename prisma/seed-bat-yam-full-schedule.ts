import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import {
  PrismaClient,
  DayCategory,
  ScheduleStatus,
  ShiftType,
  SystemRole,
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
  name: 'אפריל 2026 - שיבוץ דמו',
  startDate: '2026-04-26',
  endDate: '2026-05-09',
  submissionDeadline: '2026-04-25T20:00:00.000Z',
};

const SHIFT_TYPES = [ShiftType.MORNING, ShiftType.EVENING, ShiftType.NIGHT] as const;
const DAY_CATEGORIES = [
  DayCategory.WEEKDAY,
  DayCategory.FRIDAY,
  DayCategory.SATURDAY,
  DayCategory.HOLIDAY,
] as const;

/** תקנים עם כוח אדם נדרש — אחמ״ש, בקר, מאבטח */
const STAFFED_POSITION_CODES = [2, 3, 4] as const;

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

async function getStaffedPositions(courtId: string) {
  const positions = await prisma.position.findMany({
    where: {
      courtId,
      isActive: true,
      code: { in: [...STAFFED_POSITION_CODES] },
    },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

  if (positions.length !== STAFFED_POSITION_CODES.length) {
    throw new Error(
      `Expected positions ${STAFFED_POSITION_CODES.join(', ')} for court ${courtId}. Run prisma/seed.ts first.`,
    );
  }

  return positions;
}

async function ensureShiftCapacities(courtId: string, positions: Array<{ id: string; code: number }>) {
  let display = 0;

  for (const shiftType of SHIFT_TYPES) {
    for (const dayCategory of DAY_CATEGORIES) {
      for (const position of positions) {
        display += 1;
        const requiredCount = position.code === 4 ? 2 : 1;

        await prisma.staffingRequirement.upsert({
          where: {
            courtId_positionId_shiftType_dayCategory: {
              courtId,
              positionId: position.id,
              shiftType,
              dayCategory,
            },
          },
          create: {
            courtId,
            positionId: position.id,
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
  byPositionName: Map<string, { id: string; firstName: string; lastName: string }[]>;
  rotation: number;
}): { id: string; firstName: string; lastName: string } {
  const { positionName, byPositionName, rotation } = params;
  const pool = byPositionName.get(positionName) ?? [];
  if (pool.length > 0) {
    return pool[rotation % pool.length]!;
  }
  const all = [...byPositionName.values()].flat();
  if (all.length === 0) {
    throw new Error('No employees in pool for assignment');
  }
  return all[rotation % all.length]!;
}

async function deleteExistingSchedules(courtId: string, startDate: Date, endDate: Date) {
  const existingSameRange = await prisma.schedule.findFirst({
    where: { courtId, startDate, endDate },
    select: { id: true },
  });

  if (existingSameRange) {
    await prisma.schedule.delete({ where: { id: existingSameRange.id } });
  }

  await prisma.schedule.deleteMany({
    where: {
      courtId,
      status: ScheduleStatus.OPEN_FOR_SUBMISSION,
    },
  });
}

export async function seedBatYamFullSchedule() {
  const court = await prisma.court.findUnique({
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
      systemRole: SystemRole.MANAGER,
      employee: { courtId: court.id },
    },
    select: { id: true, email: true },
  });

  if (!manager) {
    throw new Error(`Manager user not found for court: ${court.name}`);
  }

  const startDate = parseDateOnly(DEMO_PERIOD.startDate);
  const endDate = parseDateOnly(DEMO_PERIOD.endDate);

  await deleteExistingSchedules(court.id, startDate, endDate);

  const schedule = await prisma.schedule.create({
    data: {
      courtId: court.id,
      name: DEMO_PERIOD.name,
      startDate,
      endDate,
      submissionDeadline: new Date(DEMO_PERIOD.submissionDeadline),
      status: ScheduleStatus.DRAFT,
      createdById: manager.id,
    },
  });

  const employees = await prisma.employee.findMany({
    where: { courtId: court.id, isActive: true },
    include: { position: { select: { name: true } } },
  });

  if (employees.length === 0) {
    throw new Error(`No active employees found for ${court.name}. Run prisma/seed.ts first.`);
  }

  const byPositionName = new Map<string, { id: string; firstName: string; lastName: string }[]>();
  for (const employee of employees) {
    const name = employee.position.name;
    const list = byPositionName.get(name) ?? [];
    list.push({ id: employee.id, firstName: employee.firstName, lastName: employee.lastName });
    byPositionName.set(name, list);
  }

  const capacityRows = await prisma.staffingRequirement.findMany({
    where: { courtId: court.id, isActive: true },
    select: { positionId: true, shiftType: true, dayCategory: true, requiredCount: true },
  });

  const capKey = (positionId: string, shiftType: ShiftType, dayCategory: DayCategory) =>
    `${positionId}|${shiftType}|${dayCategory}`;

  const capMap = new Map<string, number>();
  for (const row of capacityRows) {
    capMap.set(capKey(row.positionId, row.shiftType, row.dayCategory), row.requiredCount);
  }

  const dates = eachDateInclusive(DEMO_PERIOD.startDate, DEMO_PERIOD.endDate);
  const assignmentRows: Array<{
    scheduleId: string;
    employeeId: string;
    courtId: string;
    positionId: string;
    date: Date;
    shiftType: ShiftType;
    slotIndex: number;
  }> = [];

  let rotation = 0;

  for (const iso of dates) {
    const dayCategory = dayCategoryForDate(iso);
    const date = parseDateOnly(iso);

    for (const shiftType of SHIFT_TYPES) {
      for (const { id: positionId, name: positionName } of positions) {
        const amount = capMap.get(capKey(positionId, shiftType, dayCategory)) ?? 0;
        for (let slotIndex = 0; slotIndex < amount; slotIndex += 1) {
          const employee = pickEmployeeForSlot({
            positionName,
            byPositionName,
            rotation: rotation++,
          });
          assignmentRows.push({
            scheduleId: schedule.id,
            employeeId: employee.id,
            courtId: court.id,
            positionId,
            date,
            shiftType,
            slotIndex,
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
