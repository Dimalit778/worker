import { resolve } from 'node:path';

import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';

import { Position, PrismaClient, SystemRole } from '../src/generated/prisma/client';

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
    prisma.schedulingPeriod.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.user.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.court.deleteMany(),
    prisma.region.deleteMany(),
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

async function upsertRegions() {
  const jerusalem = await prisma.region.upsert({
    where: { code: 'JERUSALEM' },
    update: { name: 'מחוז ירושלים', isActive: true },
    create: { name: 'מחוז ירושלים', code: 'JERUSALEM' },
  });

  const telAviv = await prisma.region.upsert({
    where: { code: 'TEL_AVIV' },
    update: { name: 'מחוז תל אביב-יפו', isActive: true },
    create: { name: 'מחוז תל אביב-יפו', code: 'TEL_AVIV' },
  });

  const haifa = await prisma.region.upsert({
    where: { code: 'HAIFA' },
    update: { name: 'מחוז חיפה', isActive: true },
    create: { name: 'מחוז חיפה', code: 'HAIFA' },
  });

  const center = await prisma.region.upsert({
    where: { code: 'CENTER' },
    update: { name: 'מחוז מרכז', isActive: true },
    create: { name: 'מחוז מרכז', code: 'CENTER' },
  });

  return { jerusalem, telAviv, haifa, center };
}

async function upsertCourts(regions: {
  jerusalem: { id: string };
  telAviv: { id: string };
  haifa: { id: string };
  center: { id: string };
}) {
  const vaitzman = await prisma.court.upsert({
    where: { code: 'VAITZMAN' },
    update: { name: 'בית משפט מחוזי תל אביב (ויצמן)', isActive: true, regionId: regions.telAviv.id },
    create: { name: 'בית משפט מחוזי תל אביב (ויצמן)', code: 'VAITZMAN', regionId: regions.telAviv.id },
  });

  const shoken = await prisma.court.upsert({
    where: { code: 'SHOKEN' },
    update: { name: 'בית משפט שוקן', isActive: true, regionId: regions.telAviv.id },
    create: { name: 'בית משפט שוקן', code: 'SHOKEN', regionId: regions.telAviv.id },
  });

  const batYam = await prisma.court.upsert({
    where: { code: 'BAT_YAM' },
    update: { name: 'בית משפט שלום בת ים', isActive: true, regionId: regions.telAviv.id },
    create: { name: 'בית משפט שלום בת ים', code: 'BAT_YAM', regionId: regions.telAviv.id },
  });

  const jerusalemMehuzin = await prisma.court.upsert({
    where: { code: 'JERUSALEM_MEHUZIN' },
    update: { name: 'בית משפט מחוזי ירושלים', isActive: true, regionId: regions.jerusalem.id },
    create: { name: 'בית משפט מחוזי ירושלים', code: 'JERUSALEM_MEHUZIN', regionId: regions.jerusalem.id },
  });

  return { vaitzman, shoken, batYam, jerusalemMehuzin };
}

async function createUserWithEmployee(params: {
  email: string;
  password: string;
  systemRole: SystemRole;
  name: string;
  phone?: string;
  position: Position;
  primaryCourtId: string;
}) {
  const passwordHash = await bcrypt.hash(params.password, 12);

  const employee = await prisma.employee.create({
    data: {
      name: params.name,
      phone: params.phone ?? null,
      position: params.position,
      primaryCourtId: params.primaryCourtId,
      isActive: true,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: params.email,
      passwordHash,
      systemRole: params.systemRole,
      isActive: true,
      employeeId: employee.id,
    },
  });

  await prisma.courtEligibility.create({
    data: {
      employeeId: employee.id,
      courtId: params.primaryCourtId,
    },
  });

  return { user, employee };
}

// Names for each position per court slot
const NAMES: Record<string, Record<string, string[]>> = {
  VAITZMAN: {
    FACILITY_OFFICER: ['אריה כהן'],
    SHIFT_MANAGER: ['מיכל לוי', 'יוסף ברק'],
    BAKAR: ['רון שפירא', 'נועה גולן'],
    GUARD: ['דניאל כץ', 'שרה מזרחי', 'אמיר פרץ', 'תמר אלון', 'גיל זיו'],
  },
  SHOKEN: {
    FACILITY_OFFICER: ['דבורה שמיר'],
    SHIFT_MANAGER: ['עמית רוזן', 'לילה נסים'],
    BAKAR: ['בנימין טל', 'אורית פישר'],
    GUARD: ['יעקב כהן', 'רחל בן-דוד', 'אסף לוי', 'נעמה ורד', 'עידן שלום'],
  },
  BAT_YAM: {
    FACILITY_OFFICER: ['שלמה אביב'],
    SHIFT_MANAGER: ['חנה מור', 'ניסים אזולאי'],
    BAKAR: ['צבי הרצוג', 'מרים סבג'],
    GUARD: ['אלי ביטון', 'שושנה קדם', 'מאיר פלד', 'יפית עמר', 'ברוך נחום'],
  },
  JERUSALEM_MEHUZIN: {
    FACILITY_OFFICER: ['פנחס אדלר'],
    SHIFT_MANAGER: ['רינה גרוס', 'משה אוחיון'],
    BAKAR: ['זאב בן-אור', 'אסתר חיון'],
    GUARD: ['שמעון ברגר', 'חיה קפלן', 'אביגיל ריבה', 'דוד ענבר', 'רות אלבז'],
  },
};

async function seedCourtEmployees(courtCode: keyof typeof NAMES, courtId: string, emailPrefix: string) {
  const names = NAMES[courtCode];

  // 1 FACILITY_OFFICER — manager role
  await createUserWithEmployee({
    email: `manager.${emailPrefix}@example.com`,
    password: 'manager123',
    systemRole: SystemRole.MANAGER,
    name: names.FACILITY_OFFICER[0],
    position: Position.FACILITY_OFFICER,
    primaryCourtId: courtId,
  });

  // 2 SHIFT_MANAGER
  for (let i = 0; i < 2; i++) {
    await createUserWithEmployee({
      email: `shift-manager-${i + 1}.${emailPrefix}@example.com`,
      password: 'worker123',
      systemRole: SystemRole.EMPLOYEE,
      name: names.SHIFT_MANAGER[i],
      position: Position.SHIFT_MANAGER,
      primaryCourtId: courtId,
    });
  }

  // 2 BAKAR
  for (let i = 0; i < 2; i++) {
    await createUserWithEmployee({
      email: `bakar-${i + 1}.${emailPrefix}@example.com`,
      password: 'worker123',
      systemRole: SystemRole.EMPLOYEE,
      name: names.BAKAR[i],
      position: Position.BAKAR,
      primaryCourtId: courtId,
    });
  }

  // 5 GUARD
  for (let i = 0; i < 5; i++) {
    await createUserWithEmployee({
      email: `guard-${i + 1}.${emailPrefix}@example.com`,
      password: 'worker123',
      systemRole: SystemRole.EMPLOYEE,
      name: names.GUARD[i],
      position: Position.GUARD,
      primaryCourtId: courtId,
    });
  }
}

async function main() {
  await wipeDatabase();
  console.log('Seeding database...');

  await upsertSystemConfig();

  const regions = await upsertRegions();
  console.log('Regions seeded.');

  const { vaitzman, shoken, batYam, jerusalemMehuzin } = await upsertCourts(regions);
  console.log('Courts seeded.');

  await seedCourtEmployees('VAITZMAN', vaitzman.id, 'vaitzman');
  console.log('VAITZMAN employees seeded (10).');

  await seedCourtEmployees('SHOKEN', shoken.id, 'shoken');
  console.log('SHOKEN employees seeded (10).');

  await seedCourtEmployees('BAT_YAM', batYam.id, 'batyam');
  console.log('BAT_YAM employees seeded (10).');

  await seedCourtEmployees('JERUSALEM_MEHUZIN', jerusalemMehuzin.id, 'jerusalem');
  console.log('JERUSALEM_MEHUZIN employees seeded (10).');

  console.log('\nSeed complete.');
  console.log('  Courts: 4  (VAITZMAN, SHOKEN, BAT_YAM, JERUSALEM_MEHUZIN)');
  console.log('  Employees per court: 1 FACILITY_OFFICER + 2 SHIFT_MANAGER + 2 BAKAR + 5 GUARD = 10');
  console.log('  Total users: 40');
  console.log('\n  Manager password : manager123');
  console.log('  Worker password  : worker123');
  console.log('\n  Example logins:');
  console.log('    manager.vaitzman@example.com  / manager123');
  console.log('    guard-1.vaitzman@example.com  / worker123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
