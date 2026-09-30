import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';
import { DayCategory, PrismaClient, ScheduleVersionStatus, ShiftType, SystemRole } from '../src/generated/prisma/client';
import { seedCapability } from './seed-capability';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set (check .env or .env.local)');

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const DISTRICTS = [
  { name: 'מחוז ירושלים', code: 'JERUSALEM' },
  { name: 'מחוז תל אביב', code: 'TEL_AVIV' },
  { name: 'מחוז חיפה', code: 'HAIFA' },
  { name: 'מחוז מרכז', code: 'CENTER' },
];

type FacilitySeed = { name: string; code: string; districtCode: string };

const FACILITIES: FacilitySeed[] = [
  { name: 'בית משפט מחוזי ירושלים', code: 'JERUSALEM', districtCode: 'JERUSALEM' },
  { name: 'בית משפט מחוזי תל אביב (ויצמן)', code: 'VAITZMAN', districtCode: 'TEL_AVIV' },
  { name: 'בית משפט שוקן', code: 'SHOKEN', districtCode: 'TEL_AVIV' },
  { name: 'בית משפט שלום בת ים', code: 'BAT_YAM', districtCode: 'TEL_AVIV' },
  { name: 'בית משפט ראשון לציון', code: 'RISHON', districtCode: 'CENTER' },
];

const PASSWORD = '123456';

const SHIFT_ROLES = [
  { code: 1, name: 'קצין מתקן', displayOrder: 1, color: '#2563eb' },
  { code: 4, name: 'מאבטח', displayOrder: 4, color: '#dc2626' },
] as const;

const OFFICERS = [
  { firstName: 'יוסי', lastName: 'כהן' },
  { firstName: 'רונית', lastName: 'אברהם' },
  { firstName: 'משה', lastName: 'דהן' },
  { firstName: 'תומר', lastName: 'לוי' },
  { firstName: 'מיכל', lastName: 'פרץ' },
];

const EMPLOYEE_FIRST_NAMES = [
  'נועה', 'דניאל', 'מאיה', 'עומר', 'יעל',
  'איתי', 'שירה', 'אור', 'ליאור', 'הילה',
  'עידו', 'תמר', 'יונתן', 'רותם', 'גל',
  'אביגיל', 'נתנאל', 'מור', 'אלון', 'נועם',
  'שחר', 'ליה', 'אדם', 'קרן', 'בר',
];

const EMPLOYEE_LAST_NAMES = [
  'לוי', 'מזרחי', 'ביטון', 'חדד', 'אוחיון',
  'עמר', 'גולן', 'שמש', 'ברק', 'אזולאי',
  'נחום', 'סבן', 'מלכה', 'וייס', 'קדוש',
  'אלבז', 'סויסה', 'בן דוד', 'עובדיה', 'פרידמן',
  'חן', 'גבאי', 'דיין', 'סרור', 'יפרח',
];

async function main() {
  console.log('Seeding districts and facilities...');

  const districtIdByCode = new Map<string, string>();

  for (const district of DISTRICTS) {
    const record = await prisma.district.upsert({
      where: { code: district.code },
      update: { name: district.name },
      create: district,
    });
    districtIdByCode.set(district.code, record.id);
    console.log(`District: ${record.name} (${record.code})`);
  }

  for (const facility of FACILITIES) {
    const districtId = districtIdByCode.get(facility.districtCode);
    if (!districtId) throw new Error(`District not found for code: ${facility.districtCode}`);

    const record = await prisma.facility.upsert({
      where: { code: facility.code },
      update: { name: facility.name, districtId },
      create: { name: facility.name, code: facility.code, districtId },
    });
    console.log(`Facility: ${record.name} (${record.code})`);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  let officers = 0;
  let employees = 0;

  for (const [facilityIndex, facility] of FACILITIES.entries()) {
    const record = await prisma.facility.findUnique({ where: { code: facility.code } });
    if (!record) throw new Error(`Facility not found: ${facility.code}`);

    const roleIdByCode = new Map<number, string>();
    for (const role of SHIFT_ROLES) {
      const shiftRole = await prisma.shiftRole.upsert({
        where: { facilityId_code: { facilityId: record.id, code: role.code } },
        update: {
          name: role.name,
          displayOrder: role.displayOrder,
          color: role.color,
          requiredCapability: seedCapability(role.code),
          isActive: true,
        },
        create: {
          facilityId: record.id,
          code: role.code,
          name: role.name,
          displayOrder: role.displayOrder,
          color: role.color,
          requiredCapability: seedCapability(role.code),
          isActive: true,
        },
      });
      roleIdByCode.set(role.code, shiftRole.id);
    }

    const officerRoleId = roleIdByCode.get(1);
    const guardRoleId = roleIdByCode.get(4);
    if (!officerRoleId || !guardRoleId) throw new Error(`Shift roles missing for ${facility.code}`);

    const officer = OFFICERS[facilityIndex];
    if (!officer) throw new Error(`Officer missing for ${facility.code}`);
    const officerEmail = `katzin.${facility.code.toLowerCase()}@local.test`;
    if (await createPerson({
      ...officer,
      email: officerEmail,
      phone: `050-2${String(facilityIndex + 1).padStart(2, '0')}0000`,
      facilityId: record.id,
      shiftRoleId: officerRoleId,
      positionCode: 1,
      isManager: true,
      passwordHash,
    })) {
      officers += 1;
    }

    for (let employeeIndex = 0; employeeIndex < 5; employeeIndex += 1) {
      const personIndex = facilityIndex * 5 + employeeIndex;
      const firstName = EMPLOYEE_FIRST_NAMES[personIndex];
      const lastName = EMPLOYEE_LAST_NAMES[personIndex];
      if (!firstName || !lastName) throw new Error(`Employee name missing at index ${personIndex}`);

      if (await createPerson({
        firstName,
        lastName,
        email: `guard.${facility.code.toLowerCase()}.${employeeIndex + 1}@local.test`,
        phone: `050-3${String(personIndex + 1).padStart(2, '0')}0000`,
        facilityId: record.id,
        shiftRoleId: guardRoleId,
        positionCode: 4,
        isManager: false,
        passwordHash,
      })) {
        employees += 1;
      }
    }
  }

  const rosters = await seedActiveRosters();

  console.log(`\nDone — ${DISTRICTS.length} districts, ${FACILITIES.length} facilities, ${officers} officers, ${employees} employees, ${rosters} active rosters`);
  console.log(`Login password for new users: ${PASSWORD}`);
}

const SHIFT_TYPES = [ShiftType.MORNING, ShiftType.EVENING, ShiftType.NIGHT] as const;
const DAY_CATEGORIES = [DayCategory.WEEKDAY, DayCategory.FRIDAY, DayCategory.SATURDAY] as const;

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function formatIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function currentFortnight(): { start: Date; end: Date } {
  const iso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const today = utcDate(iso);
  const start = addUtcDays(today, -today.getUTCDay());
  return { start, end: addUtcDays(start, 13) };
}

async function seedActiveRosters(): Promise<number> {
  const { start, end } = currentFortnight();
  let created = 0;

  for (const facility of FACILITIES) {
    const record = await prisma.facility.findUnique({ where: { code: facility.code } });
    if (!record) throw new Error(`Facility not found: ${facility.code}`);

    const existing = await prisma.roster.findFirst({
      where: {
        facilityId: record.id,
        archivedAt: null,
        versions: { some: { status: ScheduleVersionStatus.PUBLISHED, isActive: true } },
        period: { startDate: { lte: start }, endDate: { gte: start } },
      },
      select: { id: true },
    });
    if (existing) {
      console.log(`Active roster already exists: ${facility.code}`);
      continue;
    }

    const manager = await prisma.user.findFirst({
      where: { facilityRoles: { some: { facilityId: record.id, role: 'MANAGER' } } },
      select: { id: true },
    });
    if (!manager) throw new Error(`Manager not found for ${facility.code}`);

    const guardRole = await prisma.shiftRole.findFirst({
      where: { facilityId: record.id, code: 4, isActive: true },
      select: { id: true },
    });
    if (!guardRole) throw new Error(`Guard shift role not found for ${facility.code}`);

    const guards = await prisma.employee.findMany({
      where: { facilityId: record.id, isActive: true, primaryShiftRoleId: guardRole.id },
      select: { id: true, displayName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
    if (guards.length === 0) throw new Error(`No guards found for ${facility.code}`);

    for (const shiftType of SHIFT_TYPES) {
      for (const dayCategory of DAY_CATEGORIES) {
        await prisma.staffingRequirement.upsert({
          where: {
            facilityId_shiftRoleId_shiftType_dayCategory: {
              facilityId: record.id,
              shiftRoleId: guardRole.id,
              shiftType,
              dayCategory,
            },
          },
          update: { requiredCount: 1, isActive: true, displayOrder: 4 },
          create: {
            facilityId: record.id,
            shiftRoleId: guardRole.id,
            shiftType,
            dayCategory,
            requiredCount: 1,
            isActive: true,
            displayOrder: 4,
          },
        });
      }
    }

    const period = await prisma.schedulePeriod.create({
      data: {
        facilityId: record.id,
        name: `שיבוץ פעיל ${formatIso(start)}`,
        startDate: start,
        endDate: end,
        submissionDeadline: addUtcDays(start, -1),
        submissionState: 'CLOSED',
      },
    });

    const roster = await prisma.roster.create({
      data: {
        facilityId: record.id,
        periodId: period.id,
        createdById: manager.id,
      },
    });

    const version = await prisma.rosterVersion.create({
      data: {
        scheduleId: roster.id,
        facilityId: record.id,
        version: 1,
        status: ScheduleVersionStatus.DRAFT,
        isActive: false,
        createdById: manager.id,
      },
    });

    const assignments = [];
    for (let dayIndex = 0; dayIndex < 14; dayIndex += 1) {
      const date = addUtcDays(start, dayIndex);
      for (let shiftIndex = 0; shiftIndex < SHIFT_TYPES.length; shiftIndex += 1) {
        const guard = guards[(dayIndex * SHIFT_TYPES.length + shiftIndex) % guards.length];
        if (!guard) continue;
        assignments.push({
          scheduleId: roster.id,
          versionId: version.id,
          employeeId: guard.id,
          facilityId: record.id,
          shiftRoleId: guardRole.id,
          date,
          shiftType: SHIFT_TYPES[shiftIndex],
          source: 'MANUAL' as const,
        });
      }
    }

    await prisma.shiftAssignment.createMany({ data: assignments });

    await prisma.rosterVersion.update({
      where: { id: version.id },
      data: {
        status: ScheduleVersionStatus.PUBLISHED,
        isActive: true,
        publishedAt: new Date(),
      },
    });

    created += 1;
    console.log(`Active roster: ${facility.code} (${assignments.length} assignments, ${guards.length} guards)`);
  }

  return created;
}

async function createPerson(person: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  facilityId: string;
  shiftRoleId: string;
  positionCode: number;
  isManager: boolean;
  passwordHash: string;
}): Promise<boolean> {
  const existingUser = await prisma.user.findUnique({ where: { email: person.email } });
  if (existingUser) {
    console.log(`Skipping existing user: ${person.email}`);
    return false;
  }

  const employee = await prisma.employee.create({
    data: {
      firstName: person.firstName,
      lastName: person.lastName,
      displayName: person.firstName,
      phone: person.phone,
      primaryShiftRoleId: person.shiftRoleId,
      capability: seedCapability(person.positionCode),
      facilityId: person.facilityId,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      email: person.email,
      passwordHash: person.passwordHash,
      systemRole: SystemRole.USER,
      facilityRoles: person.isManager ? { create: { facilityId: person.facilityId, role: 'MANAGER' } } : undefined,
      employeeId: employee.id,
    },
  });

  console.log(`${person.isManager ? 'Officer' : 'Employee'}: ${person.firstName} ${person.lastName} (${person.email})`);
  return true;
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
