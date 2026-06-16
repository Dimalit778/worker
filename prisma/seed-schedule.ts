import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient, SystemRole, ShiftType, ScheduleStatus } from '../src/generated/prisma/client';

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

const SCHEDULE_NAME = 'אפריל 2026 - שיבוץ קיים';
const START_DATE = '2026-04-26';
const END_DATE = '2026-05-09';
const SUBMISSION_DEADLINE = '2026-04-25T20:00:00.000Z';

const SHIFT_TYPES = [ShiftType.MORNING, ShiftType.EVENING, ShiftType.NIGHT] as const;

/** אחמ״ש, בקר, מאבטח — מקביל ל-SHIFT_MANAGER / BAKAR / GUARD בגרסה הישנה */
const ASSIGNMENT_POSITION_CODES = [2, 3, 4] as const;

function parseDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

async function deleteExistingSchedule(courtId: string, startDate: Date, endDate: Date) {
  const existing = await prisma.schedule.findFirst({
    where: { courtId, startDate, endDate },
    select: { id: true },
  });

  if (existing) {
    await prisma.schedule.delete({ where: { id: existing.id } });
    console.log('🧹 Existing Bat Yam schedule deleted');
  }
}

async function seedBatYamExistingSchedule() {
  const court = await prisma.court.findUnique({
    where: { code: COURT_CODE },
    select: { id: true, name: true, code: true },
  });

  if (!court) {
    throw new Error(`Court not found: ${COURT_CODE}. Run prisma/seed.ts first.`);
  }

  const manager = await prisma.user.findFirst({
    where: {
      systemRole: SystemRole.MANAGER,
      employee: { courtId: court.id },
    },
    select: {
      id: true,
      email: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  });

  if (!manager) {
    throw new Error(`Manager user not found for court: ${court.name}`);
  }

  const startDate = parseDateOnly(START_DATE);
  const endDate = parseDateOnly(END_DATE);

  await deleteExistingSchedule(court.id, startDate, endDate);

  const employees = await prisma.employee.findMany({
    where: { courtId: court.id, isActive: true },
    select: { id: true, firstName: true, lastName: true, position: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  if (employees.length === 0) {
    throw new Error(`No active employees found for ${court.name}`);
  }

  const positions = await prisma.position.findMany({
    where: {
      courtId: court.id,
      isActive: true,
      code: { in: [...ASSIGNMENT_POSITION_CODES] },
    },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

  if (positions.length !== ASSIGNMENT_POSITION_CODES.length) {
    const found = positions.map((p) => p.code).join(', ');
    throw new Error(
      `Expected positions with codes ${ASSIGNMENT_POSITION_CODES.join(', ')} for ${court.name}, found: ${found}`,
    );
  }

  const schedule = await prisma.schedule.create({
    data: {
      courtId: court.id,
      name: SCHEDULE_NAME,
      startDate,
      endDate,
      submissionDeadline: new Date(SUBMISSION_DEADLINE),
      status: ScheduleStatus.ACTIVE,
      createdById: manager.id,
      publishedAt: new Date(),
    },
  });

  const assignments = [];

  for (let dayIndex = 0; dayIndex < 14; dayIndex++) {
    const date = addDays(startDate, dayIndex);

    for (let shiftIndex = 0; shiftIndex < SHIFT_TYPES.length; shiftIndex++) {
      const shiftType = SHIFT_TYPES[shiftIndex];

      for (let positionIndex = 0; positionIndex < positions.length; positionIndex++) {
        const position = positions[positionIndex]!;

        /**
         * כל עובד פעיל של בית המשפט יכול להשתבץ לכל תקן.
         * הרוטציה מפזרת עובדים כדי שלא אותו עובד יהיה בכל התאים.
         */
        const employeeIndex =
          (dayIndex * SHIFT_TYPES.length * positions.length +
            shiftIndex * positions.length +
            positionIndex) %
          employees.length;

        const employee = employees[employeeIndex]!;

        assignments.push({
          scheduleId: schedule.id,
          employeeId: employee.id,
          positionId: position.id,
          date,
          shiftType,
          slotIndex: 0,
          isManualOverride: false,
          courtId: court.id,
        });
      }
    }
  }

  await prisma.shiftAssignment.createMany({ data: assignments });

  console.log('✅ Bat Yam existing schedule created');
  console.log({
    court: court.name,
    scheduleId: schedule.id,
    assignmentsCount: assignments.length,
  });
}

seedBatYamExistingSchedule()
  .catch(async (error) => {
    console.error('❌ Failed to seed Bat Yam schedule');
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
