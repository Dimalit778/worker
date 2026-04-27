import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient, SystemRole, ShiftType, PeriodStatus, ScheduleStatus } from '../src/generated/prisma/client';

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

const PERIOD_NAME = 'אפריל 2026 - שיבוץ קיים';
const START_DATE = '2026-04-26';
const END_DATE = '2026-05-09';
const SUBMISSION_DEADLINE = '2026-04-25T20:00:00.000Z';

const SHIFT_TYPES = [ShiftType.MORNING, ShiftType.EVENING, ShiftType.NIGHT] as const;

const ROLE_CODES = ['SHIFT_MANAGER', 'BAKAR', 'GUARD'] as const;

function parseDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

async function seedBatYamExistingSchedule() {
  const court = await prisma.court.findUnique({
    where: {
      code: COURT_CODE,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });

  if (!court) {
    throw new Error(`Court not found: ${COURT_CODE}`);
  }

  const manager = await prisma.user.findFirst({
    where: {
      systemRole: SystemRole.MANAGER,
      employee: {
        courtId: court.id,
      },
    },
    select: {
      id: true,
      email: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!manager) {
    throw new Error(`Manager user not found for court: ${court.name}`);
  }

  const startDate = parseDateOnly(START_DATE);
  const endDate = parseDateOnly(END_DATE);

  const existingPeriod = await prisma.schedulePeriod.findUnique({
    where: {
      courtId_startDate_endDate: {
        courtId: court.id,
        startDate,
        endDate,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingPeriod) {
    await prisma.schedulePeriod.delete({
      where: {
        id: existingPeriod.id,
      },
    });

    console.log('🧹 Existing Bat Yam schedule period deleted');
  }

  const employees = await prisma.employee.findMany({
    where: {
      courtId: court.id,
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  if (employees.length === 0) {
    throw new Error(`No active employees found for ${court.name}`);
  }

  const courtShiftRoles = await prisma.courtShiftRole.findMany({
    where: {
      courtId: court.id,
      isActive: true,
      code: {
        in: [...ROLE_CODES],
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      shiftType: true,
    },
  });

  const roleByShiftAndCode = new Map<
    string,
    {
      id: string;
      code: string;
      name: string;
      shiftType: ShiftType;
    }
  >();

  for (const role of courtShiftRoles) {
    roleByShiftAndCode.set(`${role.shiftType}:${role.code}`, role);
  }

  for (const shiftType of SHIFT_TYPES) {
    for (const roleCode of ROLE_CODES) {
      const key = `${shiftType}:${roleCode}`;

      if (!roleByShiftAndCode.has(key)) {
        throw new Error(`Missing CourtShiftRole: ${court.name} / ${key}`);
      }
    }
  }

  const period = await prisma.schedulePeriod.create({
    data: {
      courtId: court.id,
      name: PERIOD_NAME,
      startDate,
      endDate,
      submissionDeadline: new Date(SUBMISSION_DEADLINE),
      status: PeriodStatus.OPEN_FOR_SUBMISSION,
      createdById: manager.id,
    },
  });

  const schedule = await prisma.schedule.create({
    data: {
      periodId: period.id,
      status: ScheduleStatus.DRAFT,
      generatedById: manager.id,
    },
  });

  const assignments = [];

  for (let dayIndex = 0; dayIndex < 14; dayIndex++) {
    const date = addDays(startDate, dayIndex);

    for (let shiftIndex = 0; shiftIndex < SHIFT_TYPES.length; shiftIndex++) {
      const shiftType = SHIFT_TYPES[shiftIndex];

      for (let roleIndex = 0; roleIndex < ROLE_CODES.length; roleIndex++) {
        const roleCode = ROLE_CODES[roleIndex];
        const role = roleByShiftAndCode.get(`${shiftType}:${roleCode}`);

        if (!role) {
          throw new Error(`CourtShiftRole not found: ${court.name} / ${shiftType} / ${roleCode}`);
        }

        /**
         * עכשיו אין בדיקה של Position.
         * כל עובד פעיל של בית המשפט יכול להשתבץ לכל תקן.
         *
         * הרוטציה פה רק מפזרת את העובדים כדי שלא אותו עובד יהיה בכל התאים.
         */
        const employeeIndex =
          (dayIndex * SHIFT_TYPES.length * ROLE_CODES.length + shiftIndex * ROLE_CODES.length + roleIndex) %
          employees.length;

        const employee = employees[employeeIndex];

        assignments.push({
          scheduleId: schedule.id,
          employeeId: employee.id,
          courtShiftRoleId: role.id,
          date,
          slotIndex: 0,
          isManualOverride: false,
          courtId: court.id,
        });
      }
    }
  }

  await prisma.shiftAssignment.createMany({
    data: assignments,
  });

  console.log('✅ Bat Yam existing schedule created');
  console.log({
    court: court.name,
    periodId: period.id,
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
