import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';
import { PrismaClient, Position, SystemRole, ShiftType, DayCategory } from '../src/generated/prisma/client';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

export type CourtSeed = {
  name: string;
  code: string;
  regionCode: string;
};

export type EmployeeSeed = {
  firstName: string;
  lastName: string;
  phone?: string;
  position: Position;
  courtCode: string;
  email: string;
  password: string;
  systemRole?: SystemRole;
  mustChangePassword?: boolean;
};

type ShiftRoleSeed = {
  courtCode: string;
  code: string;
  name: string;
  shiftType: ShiftType;
  displayOrder: number;
};

type StaffingRuleSeed = {
  courtCode: string;
  roleCode: string;
  shiftType: ShiftType;
  dayCategory: DayCategory;
  requiredCount: number;
  displayOrder: number;
};

const REGIONS = [
  { name: 'מחוז ירושלים', code: 'JERUSALEM' },
  { name: 'מחוז תל אביב', code: 'TEL_AVIV' },
  { name: 'מחוז חיפה', code: 'HAIFA' },
  { name: 'מחוז מרכז', code: 'CENTER' },
];

const COURTS: CourtSeed[] = [
  { name: 'בית משפט מחוזי ירושלים', code: 'JERUSALEM', regionCode: 'JERUSALEM' },
  { name: 'בית משפט מחוזי תל אביב (ויצמן)', code: 'VAITZMAN', regionCode: 'TEL_AVIV' },
  { name: 'בית משפט שוקן', code: 'SHOKEN', regionCode: 'TEL_AVIV' },
  { name: 'בית משפט שלום בת ים', code: 'BAT_YAM', regionCode: 'TEL_AVIV' },
  { name: 'בית משפט ראשון לציון', code: 'RISHON', regionCode: 'CENTER' },
];

const EMPLOYEES: EmployeeSeed[] = [
  // ירושלים
  {
    firstName: 'אבי',
    lastName: 'כהן',
    phone: '050-0000001',
    position: Position.FACILITY_OFFICER,
    courtCode: 'JERUSALEM',
    email: 'avichoen@gmail.com',
    password: 'avi123',
    systemRole: SystemRole.MANAGER,
  },
  {
    firstName: 'דניאל',
    lastName: 'לוי',
    phone: '050-0000002',
    position: Position.SHIFT_MANAGER,
    courtCode: 'JERUSALEM',
    email: 'daniellevy@gmail.com',
    password: 'daniel123',
  },
  {
    firstName: 'רועי',
    lastName: 'מזרחי',
    phone: '050-0000003',
    position: Position.BAKAR,
    courtCode: 'JERUSALEM',
    email: 'roimizrahi@gmail.com',
    password: 'roi123',
  },
  {
    firstName: 'נועם',
    lastName: 'ביטון',
    phone: '050-0000004',
    position: Position.GUARD,
    courtCode: 'JERUSALEM',
    email: 'noambiton@gmail.com',
    password: 'noam123',
  },
  {
    firstName: 'שחר',
    lastName: 'אוחנה',
    phone: '050-0000005',
    position: Position.GUARD,
    courtCode: 'JERUSALEM',
    email: 'shaharohana@gmail.com',
    password: 'shahar123',
  },

  // ויצמן
  {
    firstName: 'אלרואי',
    lastName: 'מגידיש',
    phone: '050-0000006',
    position: Position.FACILITY_OFFICER,
    courtCode: 'VAITZMAN',
    email: 'elroimegidish@gmail.com',
    password: 'elroi123',
    systemRole: SystemRole.MANAGER,
  },
  {
    firstName: 'שוהם',
    lastName: 'מלכה',
    phone: '050-0000007',
    position: Position.SHIFT_MANAGER,
    courtCode: 'VAITZMAN',
    email: 'shohammalka@gmail.com',
    password: 'shoham123',
  },
  {
    firstName: 'איתי',
    lastName: 'שלום',
    phone: '050-0000008',
    position: Position.BAKAR,
    courtCode: 'VAITZMAN',
    email: 'itaishalom@gmail.com',
    password: 'itai123',
  },
  {
    firstName: 'אתי',
    lastName: 'לולה',
    phone: '050-0000009',
    position: Position.GUARD,
    courtCode: 'VAITZMAN',
    email: 'etilola@gmail.com',
    password: 'etil123',
  },
  {
    firstName: 'בן',
    lastName: 'חיים',
    phone: '050-0000010',
    position: Position.GUARD,
    courtCode: 'VAITZMAN',
    email: 'benhaim@gmail.com',
    password: 'ben123',
  },

  // שוקן
  {
    firstName: 'אסף',
    lastName: 'גולן',
    phone: '050-0000011',
    position: Position.FACILITY_OFFICER,
    courtCode: 'SHOKEN',
    email: 'asafgolan@gmail.com',
    password: 'asaf123',
    systemRole: SystemRole.MANAGER,
  },
  {
    firstName: 'אופיר',
    lastName: 'דוד',
    phone: '050-0000012',
    position: Position.SHIFT_MANAGER,
    courtCode: 'SHOKEN',
    email: 'ofirdavid@gmail.com',
    password: 'ofir123',
  },
  {
    firstName: 'ליאור',
    lastName: 'סבן',
    phone: '050-0000013',
    position: Position.BAKAR,
    courtCode: 'SHOKEN',
    email: 'liorsaban@gmail.com',
    password: 'lior123',
  },
  {
    firstName: 'עידן',
    lastName: 'אמסלם',
    phone: '050-0000014',
    position: Position.GUARD,
    courtCode: 'SHOKEN',
    email: 'idanamsalem@gmail.com',
    password: 'idan123',
  },

  // בת ים
  {
    firstName: 'תומר',
    lastName: 'לוי',
    phone: '050-0000015',
    position: Position.FACILITY_OFFICER,
    courtCode: 'BAT_YAM',
    email: 'tomerlevi@gmail.com',
    password: 'tomer123',
    systemRole: SystemRole.MANAGER,
  },
  {
    firstName: 'דימה',
    lastName: 'ליטבינוב',
    phone: '050-0000016',
    position: Position.SHIFT_MANAGER,
    courtCode: 'BAT_YAM',
    email: 'dimalit@gmail.com',
    password: 'dima123',
  },
  {
    firstName: 'דימה',
    lastName: 'גוכמן',
    phone: '050-0000017',
    position: Position.SHIFT_MANAGER,
    courtCode: 'BAT_YAM',
    email: 'dimagofman@gmail.com',
    password: 'dima123',
  },
  {
    firstName: 'איב',
    lastName: 'לוי',
    phone: '050-0000018',
    position: Position.SHIFT_MANAGER,
    courtCode: 'BAT_YAM',
    email: 'evelevi@gmail.com',
    password: 'eve123',
  },
  {
    firstName: 'אושר',
    lastName: 'עמר',
    phone: '050-0000019',
    position: Position.BAKAR,
    courtCode: 'BAT_YAM',
    email: 'oshramar@gmail.com',
    password: 'oshr123',
  },
  {
    firstName: 'בן',
    lastName: 'הרגס',
    phone: '050-0000020',
    position: Position.BAKAR,
    courtCode: 'BAT_YAM',
    email: 'benharges@gmail.com',
    password: 'ben123',
  },
  {
    firstName: 'יוחאי',
    lastName: 'אוחיון',
    phone: '050-0000021',
    position: Position.BAKAR,
    courtCode: 'BAT_YAM',
    email: 'yochaiohayon@gmail.com',
    password: 'yochai123',
  },
  {
    firstName: 'אילה',
    lastName: 'גין',
    phone: '050-0000022',
    position: Position.GUARD,
    courtCode: 'BAT_YAM',
    email: 'ayalagin@gmail.com',
    password: 'ayala123',
  },
  {
    firstName: 'ניק',
    lastName: 'שבדש',
    phone: '050-0000023',
    position: Position.GUARD,
    courtCode: 'BAT_YAM',
    email: 'nikshabdush@gmail.com',
    password: 'nik123',
  },
  {
    firstName: 'שני',
    lastName: 'פנחס',
    phone: '050-0000024',
    position: Position.GUARD,
    courtCode: 'BAT_YAM',
    email: 'shaniphenchas@gmail.com',
    password: 'shani123',
  },
];

const ALL_SHIFT_TYPES = [ShiftType.MORNING, ShiftType.EVENING, ShiftType.NIGHT] as const;

const ALL_DAY_CATEGORIES = [
  DayCategory.WEEKDAY,
  DayCategory.FRIDAY,
  DayCategory.SATURDAY,
  DayCategory.HOLIDAY,
] as const;

const SHIFT_ROLE_DEFINITIONS = [
  {
    code: 'SHIFT_MANAGER',
    name: 'אחמ״ש',
    displayOrder: 1,
  },
  {
    code: 'BAKAR',
    name: 'בקר',
    displayOrder: 2,
  },
  {
    code: 'GUARD',
    name: 'מאבטח',
    displayOrder: 3,
  },
] as const;

const COURT_SHIFT_ROLES: ShiftRoleSeed[] = COURTS.flatMap((court) =>
  ALL_SHIFT_TYPES.flatMap((shiftType) =>
    SHIFT_ROLE_DEFINITIONS.map((role) => ({
      courtCode: court.code,
      code: role.code,
      name: role.name,
      shiftType,
      displayOrder: role.displayOrder,
    })),
  ),
);

const STAFFING_RULES: StaffingRuleSeed[] = COURTS.flatMap((court) =>
  ALL_SHIFT_TYPES.flatMap((shiftType) =>
    ALL_DAY_CATEGORIES.flatMap((dayCategory) =>
      SHIFT_ROLE_DEFINITIONS.map((role) => ({
        courtCode: court.code,
        roleCode: role.code,
        shiftType,
        dayCategory,
        requiredCount: 1,
        displayOrder: role.displayOrder,
      })),
    ),
  ),
);

async function clearDatabase() {
  await prisma.scheduleChangeLog.deleteMany();
  await prisma.scheduleWarning.deleteMany();
  await prisma.shiftAssignment.deleteMany();
  await prisma.schedule.deleteMany();

  await prisma.availabilityEntry.deleteMany();
  await prisma.availability.deleteMany();

  await prisma.fairnessRecord.deleteMany();

  await prisma.courtStaffRule.deleteMany();
  await prisma.courtShiftRole.deleteMany();

  await prisma.schedulePeriod.deleteMany();

  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  await prisma.employee.deleteMany();
  await prisma.court.deleteMany();
  await prisma.region.deleteMany();

  await prisma.verificationToken.deleteMany();
  await prisma.systemConfig.deleteMany();
}

async function seedRegionsAndCourts() {
  const regionIdByCode = new Map<string, string>();

  for (const region of REGIONS) {
    const created = await prisma.region.create({
      data: region,
    });

    regionIdByCode.set(region.code, created.id);
  }

  for (const court of COURTS) {
    const regionId = regionIdByCode.get(court.regionCode);

    if (!regionId) {
      throw new Error(`Region not found: ${court.regionCode}`);
    }

    await prisma.court.create({
      data: {
        name: court.name,
        code: court.code,
        regionId,
      },
    });
  }
}

async function seedEmployeesAndUsers() {
  for (const emp of EMPLOYEES) {
    const court = await prisma.court.findUnique({
      where: { code: emp.courtCode },
    });

    if (!court) {
      throw new Error(`Court not found for employee: ${emp.email}`);
    }

    const employee = await prisma.employee.create({
      data: {
        firstName: emp.firstName,
        lastName: emp.lastName,
        phone: emp.phone ?? null,
        positionId: emp.position.id,
        courtId: court.id,
        isActive: true,
      },
    });

    const passwordHash = await bcrypt.hash(emp.password, 10);

    await prisma.user.create({
      data: {
        email: emp.email,
        passwordHash,
        systemRole: emp.systemRole ?? SystemRole.EMPLOYEE,
        mustChangePassword: emp.mustChangePassword ?? false,
        employeeId: employee.id,
      },
    });
  }
}

async function seedCourtShiftRoles() {
  for (const role of COURT_SHIFT_ROLES) {
    const court = await prisma.court.findUnique({
      where: { code: role.courtCode },
    });

    if (!court) {
      throw new Error(`Court not found for role: ${role.courtCode} / ${role.code}`);
    }

    const createdRole = await prisma.courtShiftRole.create({
      data: {
        courtId: court.id,
        code: role.code,
        name: role.name,
        shiftType: role.shiftType,
        isActive: true,
        displayOrder: role.displayOrder,
      },
    });
  }
}

async function seedStaffRules() {
  for (const rule of STAFFING_RULES) {
    const court = await prisma.court.findUnique({
      where: { code: rule.courtCode },
    });

    if (!court) {
      throw new Error(`Court not found for staffing rule: ${rule.courtCode}`);
    }

    const courtShiftRole = await prisma.courtShiftRole.findFirst({
      where: {
        courtId: court.id,
        code: rule.roleCode,
        shiftType: rule.shiftType,
      },
    });

    if (!courtShiftRole) {
      throw new Error(`CourtShiftRole not found for ${rule.courtCode} / ${rule.roleCode} / ${rule.shiftType}`);
    }

    await prisma.courtStaffRule.create({
      data: {
        courtShiftRoleId: courtShiftRole.id,
        dayCategory: rule.dayCategory,
        requiredCount: rule.requiredCount,
        displayOrder: rule.displayOrder,
      },
    });
  }
}

async function main() {
  console.log('🧹 Clearing database...');
  await clearDatabase();
  console.log('✅ Database cleared');

  console.log('🌍 Seeding regions and courts...');
  await seedRegionsAndCourts();
  console.log('✅ Regions and courts seeded');

  console.log('👥 Seeding employees and users...');
  await seedEmployeesAndUsers();
  console.log('✅ Employees and users seeded');

  console.log('🧩 Seeding court shift roles...');
  await seedCourtShiftRoles();
  console.log('✅ Court shift roles seeded');

  console.log('📐 Seeding staff rules...');
  await seedStaffRules();
  console.log('✅ Staff rules seeded');

  console.log('🎉 Seed completed successfully');
}

main()
  .catch(async (error) => {
    console.error('❌ Seed failed');
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
