import { resolve } from 'node:path';

import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';

import { calendarDateISO, utcNoonFromCalendarISO } from '../src/lib/periods/current-scheduling-period';
import { PeriodStatus, Position, PrismaClient, ShiftType, SystemRole } from '../src/generated/prisma/client';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set (check .env or .env.local)');
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function wipeDatabase() {
  console.log('Wiping database...');

  await prisma.$transaction([
    prisma.shiftAssignment.deleteMany(),
    prisma.scheduleWarning.deleteMany(),
    prisma.schedule.deleteMany(),
    prisma.availabilityEntry.deleteMany(),
    prisma.availability.deleteMany(),
    prisma.fairnessRecord.deleteMany(),
    prisma.courtEligibility.deleteMany(),
    prisma.shiftCapacityRule.deleteMany(),
    prisma.schedulingPeriod.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.user.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.court.deleteMany(),
    prisma.district.deleteMany(),
    prisma.systemConfig.deleteMany(),
  ]);
}
async function upsertSystemConfig() {
  await prisma.systemConfig.upsert({
    where: { key: 'weekly_min_morning' },
    update: { value: 2 },
    create: { key: 'weekly_min_morning', value: 2 },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'weekly_min_evening' },
    update: { value: 1 },
    create: { key: 'weekly_min_evening', value: 1 },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'fairness_weights' },
    update: { value: { W1: 3, W2: 2, W3: 1, W4: 1 } },
    create: { key: 'fairness_weights', value: { W1: 3, W2: 2, W3: 1, W4: 1 } },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'fairness_shift_threshold' },
    update: { value: 2 },
    create: { key: 'fairness_shift_threshold', value: 2 },
  });

  await prisma.systemConfig.upsert({
    where: { key: 'fairness_opening_duty_threshold' },
    update: { value: 2 },
    create: { key: 'fairness_opening_duty_threshold', value: 2 },
  });
}
async function upsertDistricts() {
  const jerusalem = await prisma.district.upsert({
    where: { code: 'JERUSALEM' },
    update: { name: 'מחוז ירושלים', isActive: true },
    create: { name: 'מחוז ירושלים', code: 'JERUSALEM' },
  });

  const telAviv = await prisma.district.upsert({
    where: { code: 'TEL_AVIV' },
    update: { name: 'מחוז תל אביב-יפו', isActive: true },
    create: { name: 'מחוז תל אביב-יפו', code: 'TEL_AVIV' },
  });

  const haifa = await prisma.district.upsert({
    where: { code: 'HAIFA' },
    update: { name: 'מחוז חיפה', isActive: true },
    create: { name: 'מחוז חיפה', code: 'HAIFA' },
  });

  const south = await prisma.district.upsert({
    where: { code: 'SOUTH' },
    update: { name: 'מחוז דרום', isActive: true },
    create: { name: 'מחוז דרום', code: 'SOUTH' },
  });

  const north = await prisma.district.upsert({
    where: { code: 'NORTH' },
    update: { name: 'מחוז צפון', isActive: true },
    create: { name: 'מחוז צפון', code: 'NORTH' },
  });

  const center = await prisma.district.upsert({
    where: { code: 'CENTER' },
    update: { name: 'מחוז מרכז', isActive: true },
    create: { name: 'מחוז מרכז', code: 'CENTER' },
  });

  return { jerusalem, telAviv, haifa, south, north, center };
}

async function upsertCourts(districts: {
  jerusalem: { id: string };
  telAviv: { id: string };
  haifa: { id: string };
  south: { id: string };
  north: { id: string };
  center: { id: string };
}) {
  const courtA = await prisma.court.upsert({
    where: { code: 'TEL_AVIV_DISTRICT' },
    update: {
      name: 'בית משפט מחוזי תל אביב',
      isActive: true,
      districtId: districts.telAviv.id,
    },
    create: {
      name: 'בית משפט מחוזי תל אביב',
      code: 'TEL_AVIV_DISTRICT',
      districtId: districts.telAviv.id,
    },
  });

  const courtB = await prisma.court.upsert({
    where: { code: 'BAT_YAM_MAGISTRATE' },
    update: {
      name: 'בית משפט שלום בת ים',
      isActive: true,
      districtId: districts.telAviv.id,
    },
    create: {
      name: 'בית משפט שלום בת ים',
      code: 'BAT_YAM_MAGISTRATE',
      districtId: districts.telAviv.id,
    },
  });

  const courtC = await prisma.court.upsert({
    where: { code: 'SHOKEN_MAGISTRATE' },
    update: {
      name: 'בית משפט - שוקן',
      isActive: true,
      districtId: districts.telAviv.id,
    },
    create: {
      name: 'בית משפט - שוקן',
      code: 'SHOKEN_MAGISTRATE',
      districtId: districts.telAviv.id,
    },
  });

  return { courtA, courtB, courtC };
}

async function seedCapacityRules(
  courtId: string,
  rules: Array<{ shiftType: ShiftType; dayOfWeek: number | null; minStaff: number; maxStaff: number }>,
) {
  await prisma.shiftCapacityRule.deleteMany({ where: { courtId } });

  await prisma.shiftCapacityRule.createMany({
    data: rules.map((rule) => ({
      courtId,
      shiftType: rule.shiftType,
      dayOfWeek: rule.dayOfWeek,
      minStaff: rule.minStaff,
      maxStaff: rule.maxStaff,
    })),
  });
}

async function createUserWithEmployee(params: {
  email?: string;
  employeeNumber?: string;
  mustChangePassword?: boolean;
  password: string;
  systemRole: SystemRole;
  name: string;
  phone?: string;
  position: Position;
  primaryCourtId?: string;
  employeeCode?: string;
}) {
  const passwordHash = await bcrypt.hash(params.password, 12);

  const employee = await prisma.employee.create({
    data: {
      employeeCode: params.employeeCode,
      name: params.name,
      phone: params.phone,
      position: params.position,
      primaryCourtId: params.primaryCourtId,
      isActive: true,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: params.email ?? null,
      employeeNumber: params.employeeNumber ?? null,
      mustChangePassword: params.mustChangePassword ?? false,
      passwordHash,
      systemRole: params.systemRole,
      isActive: true,
      employeeId: employee.id,
    },
  });

  if (params.primaryCourtId) {
    await prisma.courtEligibility.create({
      data: {
        employeeId: employee.id,
        courtId: params.primaryCourtId,
      },
    });
  }

  return { user, employee };
}

async function main() {
  await wipeDatabase();
  console.log('Seeding database...');

  await upsertSystemConfig();

  const districts = await upsertDistricts();

  const { courtA, courtB } = await upsertCourts(districts);

  await seedCapacityRules(courtA.id, [
    { shiftType: ShiftType.MORNING, dayOfWeek: null, minStaff: 3, maxStaff: 5 },
    { shiftType: ShiftType.EVENING, dayOfWeek: null, minStaff: 2, maxStaff: 3 },
    { shiftType: ShiftType.NIGHT, dayOfWeek: null, minStaff: 1, maxStaff: 1 },
  ]);

  await seedCapacityRules(courtB.id, [
    { shiftType: ShiftType.MORNING, dayOfWeek: null, minStaff: 2, maxStaff: 3 },
    { shiftType: ShiftType.EVENING, dayOfWeek: null, minStaff: 1, maxStaff: 2 },
  ]);

  // Manager
  const manager = await createUserWithEmployee({
    email: 'tomer@gmail.com',
    employeeNumber: '1001',
    password: 'tomer123',
    systemRole: SystemRole.MANAGER,
    name: 'תומר לוי',
    position: Position.SHIFT_MANAGER,
    primaryCourtId: courtA.id,
    employeeCode: 'EMP-001',
  });

  // Demo scheduling period covering "today" (Asia/Jerusalem)
  const todayUtc = utcNoonFromCalendarISO(calendarDateISO(new Date(), 'Asia/Jerusalem'));
  const periodStart = new Date(todayUtc);
  periodStart.setUTCDate(periodStart.getUTCDate() - 3);

  const periodEnd = new Date(periodStart);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 13);

  const seedPeriodName = 'תקופת הדגמה (seed)';

  await prisma.schedulingPeriod.create({
    data: {
      name: seedPeriodName,
      startDate: periodStart,
      endDate: periodEnd,
      submissionDeadline: new Date(periodStart.getTime() - 24 * 60 * 60 * 1000),
      status: PeriodStatus.OPEN_FOR_SUBMISSION,
      createdById: manager.user.id,
    },
  });

  // Admin
  await createUserWithEmployee({
    email: 'admin@gmail.com',
    password: 'admin123',
    systemRole: SystemRole.ADMIN,
    name: 'מנהל ראשי',
    position: Position.FACILITY_OFFICER,
    employeeCode: 'EMP-002',
  });

  // Employees
  const employeeData = [
    { email: 'dimalit@gmail.com', name: 'דימה ליטבינוב', position: Position.SHIFT_MANAGER },
    { email: 'dima@gmail.com', name: 'דימה גוכמן', position: Position.SHIFT_MANAGER },
    { email: 'noam@gmail.com', name: 'נועם לוי', position: Position.SHIFT_MANAGER },
    { email: 'shir@gmail.com', name: 'שיר ברלינר', position: Position.SHIFT_MANAGER },
    { email: 'eve@gmail.com', name: 'איב לוי', position: Position.SHIFT_MANAGER },
    { email: 'osheramar@gmail.com', name: 'אושר עמאר', position: Position.BAKAR },
    { email: 'ben@gmail.com', name: 'בן הרגס', position: Position.BAKAR },
    { email: 'yohay@gmail.com', name: 'יוחאי אוחיון', position: Position.BAKAR },
    { email: 'ayala@gmail.com', name: 'איילה גין', position: Position.GUARD },
    { email: 'nick@gmail.com', name: 'ניק שבדש', position: Position.GUARD },
    { email: 'nitzan@gmail.com', name: 'ניצן', position: Position.GUARD },
    { email: 'rafael@gmail.com', name: 'רפאל ברק', position: Position.GUARD },
    { email: 'shahar@gmail.com', name: 'שחר אף', position: Position.GUARD },
    { email: 'ariel@gmail.com', name: 'אריאל רוטייברג', position: Position.GUARD },
  ];

  let employeeCounter = 100;
  let empNumberCounter = 1002;

  for (const emp of employeeData) {
    await createUserWithEmployee({
      email: emp.email,
      employeeNumber: String(empNumberCounter++),
      password: 'worker123',
      systemRole: SystemRole.EMPLOYEE,
      name: emp.name.trim(),
      position: emp.position,
      primaryCourtId: courtA.id,
      employeeCode: `EMP-${employeeCounter++}`,
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
