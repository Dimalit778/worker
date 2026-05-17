import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  DayCategory,
  PeriodStatus,
  ScheduleStatus,
  ShiftType,
  SystemRole,
} from '../src/generated/prisma/client';
import {
  BAT_YAM_DEMO_PERIOD,
  BAT_YAM_DEMO_USERS,
  BAT_YAM_COURT_CODE,
  BAT_YAM_POSITION_NAME,
  type BatYamPositionKey,
} from './users-data';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const SHIFT_TYPES = [ShiftType.MORNING, ShiftType.EVENING, ShiftType.NIGHT] as const;
const DAY_CATEGORIES = [
  DayCategory.WEEKDAY,
  DayCategory.FRIDAY,
  DayCategory.SATURDAY,
  DayCategory.HOLIDAY,
] as const;

const DEMO_MANAGER_EMAIL = 'dimalit@gmail.com';

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
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (day === 5) return DayCategory.FRIDAY;
  if (day === 6) return DayCategory.SATURDAY;
  return DayCategory.WEEKDAY;
}

async function ensurePositions(courtId: string) {
  const order: Array<{ key: BatYamPositionKey; displayOrder: number }> = [
    { key: 'SHIFT_MANAGER', displayOrder: 1 },
    { key: 'BAKAR', displayOrder: 2 },
    { key: 'GUARD', displayOrder: 3 },
  ];

  const byKey = new Map<BatYamPositionKey, { id: string; name: string }>();

  for (const { key, displayOrder } of order) {
    const name = BAT_YAM_POSITION_NAME[key];
    const row = await prisma.position.upsert({
      where: { courtId_name: { courtId, name } },
      create: { courtId, name, isActive: true, displayOrder },
      update: { isActive: true, displayOrder },
      select: { id: true, name: true },
    });
    byKey.set(key, { id: row.id, name: row.name });
  }

  return byKey;
}

async function ensureShiftCapacities(
  courtId: string,
  byKey: Map<BatYamPositionKey, { id: string; name: string }>,
) {
  const keys: BatYamPositionKey[] = ['SHIFT_MANAGER', 'BAKAR', 'GUARD'];
  let display = 0;

  for (const st of SHIFT_TYPES) {
    for (const dc of DAY_CATEGORIES) {
      for (const pk of keys) {
        const pos = byKey.get(pk)!;
        display += 1;
        await prisma.staffingRequirement.upsert({
          where: {
            courtId_positionId_shiftType_dayCategory: {
              courtId,
              positionId: pos.id,
              shiftType: st,
              dayCategory: dc,
            },
          },
          create: {
            courtId,
            positionId: pos.id,
            shiftType: st,
            dayCategory: dc,
            requiredCount: 1,
            isActive: true,
            displayOrder: display,
          },
          update: { requiredCount: 1, isActive: true, displayOrder: display },
        });
      }
    }
  }
}

async function seedDemoUsers(
  courtId: string,
  byKey: Map<BatYamPositionKey, { id: string; name: string }>,
) {
  for (const u of BAT_YAM_DEMO_USERS) {
    const pos = byKey.get(u.position);
    if (!pos) {
      throw new Error(`Unknown position key: ${u.position}`);
    }

    const existing = await prisma.user.findUnique({
      where: { email: u.email },
      select: { id: true, employeeId: true },
    });

    if (existing?.employeeId) {
      await prisma.employee.update({
        where: { id: existing.employeeId },
        data: {
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone,
          positionId: pos.id,
          courtId,
          isActive: true,
        },
      });
      const passwordHash = await bcrypt.hash(u.password, 10);
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
      continue;
    }

    if (existing && !existing.employeeId) {
      const employee = await prisma.employee.create({
        data: {
          firstName: u.firstName,
          lastName: u.lastName,
          phone: u.phone,
          positionId: pos.id,
          courtId,
          isActive: true,
        },
      });
      const passwordHash = await bcrypt.hash(u.password, 10);
      await prisma.user.update({
        where: { id: existing.id },
        data: { employeeId: employee.id, passwordHash },
      });
      continue;
    }

    const employee = await prisma.employee.create({
      data: {
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        positionId: pos.id,
        courtId,
        isActive: true,
      },
    });
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.create({
      data: {
        email: u.email,
        passwordHash,
        systemRole: SystemRole.EMPLOYEE,
        employeeId: employee.id,
      },
    });
  }
}

/** So `/manager/schedule` can open — requires `SystemRole.MANAGER` + court on session. */
async function ensureDemoManagerForBatYam() {
  const u = await prisma.user.findUnique({
    where: { email: DEMO_MANAGER_EMAIL },
    include: { employee: { include: { court: true } } },
  });
  if (!u?.employeeId || u.employee?.court?.code !== BAT_YAM_COURT_CODE) {
    throw new Error(`Expected user ${DEMO_MANAGER_EMAIL} with Bat Yam employee for manager promotion`);
  }
  await prisma.user.update({
    where: { id: u.id },
    data: { systemRole: SystemRole.MANAGER },
  });
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

export async function seedBatYamFullSchedule() {
  const court = await prisma.court.findUnique({
    where: { code: BAT_YAM_COURT_CODE },
    select: { id: true, name: true, code: true },
  });
  if (!court) {
    throw new Error(`Court ${BAT_YAM_COURT_CODE} not found. Run region/court seed first.`);
  }

  const byKey = await ensurePositions(court.id);
  await ensureShiftCapacities(court.id, byKey);
  await seedDemoUsers(court.id, byKey);
  await ensureDemoManagerForBatYam();

  const startDate = parseDateOnly(BAT_YAM_DEMO_PERIOD.startDate);
  const endDate = parseDateOnly(BAT_YAM_DEMO_PERIOD.endDate);

  const existingSameRange = await prisma.schedulePeriod.findUnique({
    where: {
      courtId_startDate_endDate: {
        courtId: court.id,
        startDate,
        endDate,
      },
    },
    select: { id: true },
  });
  if (existingSameRange) {
    await prisma.schedulePeriod.delete({ where: { id: existingSameRange.id } });
  }

  await prisma.schedulePeriod.deleteMany({
    where: {
      courtId: court.id,
      status: PeriodStatus.OPEN_FOR_SUBMISSION,
    },
  });

  const createdBy = await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_MANAGER_EMAIL },
    select: { id: true },
  });

  const period = await prisma.schedulePeriod.create({
    data: {
      courtId: court.id,
      name: BAT_YAM_DEMO_PERIOD.name,
      startDate,
      endDate,
      submissionDeadline: new Date(BAT_YAM_DEMO_PERIOD.submissionDeadline),
      status: PeriodStatus.OPEN_FOR_SUBMISSION,
      createdById: createdBy.id,
    },
  });

  const schedule = await prisma.schedule.create({
    data: {
      periodId: period.id,
      status: ScheduleStatus.DRAFT,
      generatedById: createdBy.id,
    },
  });

  const employees = await prisma.employee.findMany({
    where: { courtId: court.id, isActive: true },
    include: { position: { select: { name: true } } },
  });

  const byPositionName = new Map<string, { id: string; firstName: string; lastName: string }[]>();
  for (const e of employees) {
    const n = e.position.name;
    const list = byPositionName.get(n) ?? [];
    list.push({ id: e.id, firstName: e.firstName, lastName: e.lastName });
    byPositionName.set(n, list);
  }

  const posMeta = (['SHIFT_MANAGER', 'BAKAR', 'GUARD'] as const).map((k) => {
    const p = byKey.get(k);
    if (!p) {
      throw new Error(`Missing position: ${k}`);
    }
    return { id: p.id, name: p.name };
  });

  const capacityRows = await prisma.staffingRequirement.findMany({
    where: { courtId: court.id, isActive: true },
    select: { positionId: true, shiftType: true, dayCategory: true, requiredCount: true },
  });

  const capKey = (positionId: string, st: ShiftType, dc: DayCategory) =>
    `${positionId}|${st}|${dc}`;

  const capMap = new Map<string, number>();
  for (const r of capacityRows) {
    capMap.set(capKey(r.positionId, r.shiftType, r.dayCategory), r.requiredCount);
  }

  const dates = eachDateInclusive(BAT_YAM_DEMO_PERIOD.startDate, BAT_YAM_DEMO_PERIOD.endDate);
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
    const dc = dayCategoryForDate(iso);
    const date = parseDateOnly(iso);

    for (const st of SHIFT_TYPES) {
      for (const { id: positionId, name: positionName } of posMeta) {
        const amount = capMap.get(capKey(positionId, st, dc)) ?? 0;
        for (let slotIndex = 0; slotIndex < amount; slotIndex += 1) {
          const emp = pickEmployeeForSlot({
            positionName,
            byPositionName,
            rotation: rotation++,
          });
          assignmentRows.push({
            scheduleId: schedule.id,
            employeeId: emp.id,
            courtId: court.id,
            positionId,
            date,
            shiftType: st,
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
    periodId: period.id,
    scheduleId: schedule.id,
    assignmentCount: assignmentRows.length,
    periodRange: { start: BAT_YAM_DEMO_PERIOD.startDate, end: BAT_YAM_DEMO_PERIOD.endDate },
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
  .then((r) => {
    console.log('✅ Bat Yam full schedule seeded');
    console.log(r);
  })
  .catch(async (err) => {
    console.error('❌ seedBatYamFullSchedule failed');
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
