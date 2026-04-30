import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';
import { PrismaClient, SystemRole, ShiftType, DayCategory } from '../src/generated/prisma/client';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

type CourtSeed = {
  name: string;
  code: string;
  regionCode: string;
};

type PositionSeed = {
  code: number;
  name: string;
  displayOrder: number;
};

type EmployeeSeed = {
  firstName: string;
  lastName: string;
  displayName: string;
  phone?: string;
  positionCode: number;
  courtCode: string;
  email: string;
  password: string;
  isReligious?: boolean;
  systemRole?: SystemRole;
  mustChangePassword?: boolean;
};

type ShiftCapacitySeed = {
  courtCode: string;
  positionCode: number;
  shiftType: ShiftType;
  dayCategory: DayCategory;
  amount: number;
  displayOrder: number;
};

const REGIONS = [
  { name: 'מחוז ירושלים', code: 'JERUSALEM' },
  { name: 'מחוז תל אביב', code: 'TEL_AVIV' },
  { name: 'מחוז חיפה', code: 'HAIFA' },
  { name: 'מחוז מרכז', code: 'CENTER' },
];

const COURTS: CourtSeed[] = [
  { name: 'בית משפט ירושלים', code: 'JERUSALEM', regionCode: 'JERUSALEM' },
  { name: 'בית משפט תל אביב ויצמן', code: 'VAITZMAN', regionCode: 'TEL_AVIV' },
  { name: 'בית משפט שוקן', code: 'SHOKEN', regionCode: 'TEL_AVIV' },
  { name: 'בית משפט שלום בת ים', code: 'BAT_YAM', regionCode: 'TEL_AVIV' },
  { name: 'בית משפט ראשון לציון', code: 'RISHON', regionCode: 'CENTER' },
];

const POSITIONS: PositionSeed[] = [
  { code: 1, name: 'קצין מתקן', displayOrder: 1 },
  { code: 2, name: 'אחמ״ש', displayOrder: 2 },
  { code: 3, name: 'בקר', displayOrder: 3 },
  { code: 4, name: 'מאבטח', displayOrder: 4 },
];

const EMPLOYEES: EmployeeSeed[] = [
  // ירושלים
  // {
  //   firstName: 'אבי',
  //   lastName: 'כהן',
  //   phone: '050-0000001',
  //   positionCode: 1,
  //   courtCode: 'JERUSALEM',
  //   email: 'avichoen@gmail.com',
  //   password: 'avi123',
  //   systemRole: SystemRole.MANAGER,
  // },
  // {
  //   firstName: 'דניאל',
  //   lastName: 'לוי',
  //   phone: '050-0000002',
  //   positionCode: 2,
  //   courtCode: 'JERUSALEM',
  //   email: 'daniellevy@gmail.com',
  //   password: 'daniel123',
  // },
  // {
  //   firstName: 'רועי',
  //   lastName: 'מזרחי',
  //   phone: '050-0000003',
  //   positionCode: 3,
  //   courtCode: 'JERUSALEM',
  //   email: 'roimizrahi@gmail.com',
  //   password: 'roi123',
  // },
  // {
  //   firstName: 'נועם',
  //   lastName: 'ביטון',
  //   phone: '050-0000004',
  //   positionCode: 4,
  //   courtCode: 'JERUSALEM',
  //   email: 'noambiton@gmail.com',
  //   password: 'noam123',
  // },
  // {
  //   firstName: 'שחר',
  //   lastName: 'אוחנה',
  //   phone: '050-0000005',
  //   positionCode: 4,
  //   courtCode: 'JERUSALEM',
  //   email: 'shaharohana@gmail.com',
  //   password: 'shahar123',
  // },

  // // ויצמן
  // {
  //   firstName: 'אלרואי',
  //   lastName: 'מגידיש',
  //   phone: '050-0000006',
  //   positionCode: 1,
  //   courtCode: 'VAITZMAN',
  //   email: 'elroimegidish@gmail.com',
  //   password: 'elroi123',
  //   systemRole: SystemRole.MANAGER,
  // },
  // {
  //   firstName: 'שוהם',
  //   lastName: 'מלכה',
  //   phone: '050-0000007',
  //   positionCode: 2,
  //   courtCode: 'VAITZMAN',
  //   email: 'shohammalka@gmail.com',
  //   password: 'shohammalka',
  // },
  // {
  //   firstName: 'איתי',
  //   lastName: 'שלום',
  //   phone: '050-0000008',
  //   positionCode: 3,
  //   courtCode: 'VAITZMAN',
  //   email: 'itaishalom@gmail.com',
  //   password: 'itaishalom',
  // },
  // {
  //   firstName: 'אתי',
  //   lastName: 'לולה',
  //   phone: '050-0000009',
  //   positionCode: 4,
  //   courtCode: 'VAITZMAN',
  //   email: 'etilola@gmail.com',
  //   password: 'etil',
  // },
  // {
  //   firstName: 'בן',
  //   lastName: 'חיים',
  //   phone: '050-0000010',
  //   positionCode: 4,
  //   courtCode: 'VAITZMAN',
  //   email: 'benhaim@gmail.com',
  //   password: 'ben',
  // },

  // // שוקן
  // {
  //   firstName: 'אסף',
  //   lastName: 'גולן',
  //   phone: '050-0000011',
  //   positionCode: 1,
  //   courtCode: 'SHOKEN',
  //   email: 'asafgolan@gmail.com',
  //   password: 'asaf',
  //   systemRole: SystemRole.MANAGER,
  // },
  // {
  //   firstName: 'אופיר',
  //   lastName: 'דוד',
  //   phone: '050-0000012',
  //   positionCode: 2,
  //   courtCode: 'SHOKEN',
  //   email: 'ofirdavid@gmail.com',
  //   password: 'ofir',
  // },
  // {
  //   firstName: 'ליאור',
  //   lastName: 'סבן',
  //   phone: '050-0000013',
  //   positionCode: 3,
  //   courtCode: 'SHOKEN',
  //   email: 'liorsaban@gmail.com',
  //   password: 'lior',
  // },
  // {
  //   firstName: 'עידן',
  //   lastName: 'אמסלם',
  //   phone: '050-0000014',
  //   positionCode: 4,
  //   courtCode: 'SHOKEN',
  //   email: 'idanamsalem@gmail.com',
  //   password: 'idan',
  // },

  // בת ים
  {
    firstName: 'תומר',
    lastName: 'לוי',
    displayName: 'תומר',
    phone: '050-0000015',
    positionCode: 1,
    courtCode: 'BAT_YAM',
    email: 'tomerlevi@gmail.com',
    password: 'tomerlevi',
    systemRole: SystemRole.MANAGER,
  },
  {
    firstName: 'דימה',
    lastName: 'ליטבינוב',
    displayName: 'דימה',
    phone: '050-0000016',
    positionCode: 2,
    courtCode: 'BAT_YAM',
    email: 'dimalit@gmail.com',
    password: 'dimalit',
  },
  {
    firstName: 'דימה',
    lastName: 'גוכמן',
    displayName: 'גוכמן',
    phone: '050-0000017',
    positionCode: 2,
    courtCode: 'BAT_YAM',
    email: 'dimagofman@gmail.com',
    password: 'dimagofman',
  },
  {
    firstName: 'איב',
    lastName: 'לוי',
    displayName: 'איב',
    phone: '050-0000018',
    positionCode: 2,
    courtCode: 'BAT_YAM',
    email: 'evelevi@gmail.com',
    password: 'evelevi',
  },
  {
    firstName: 'אושר',
    lastName: 'עמר',
    displayName: 'אושר',
    phone: '050-0000019',
    positionCode: 3,
    courtCode: 'BAT_YAM',
    email: 'oshramar@gmail.com',
    password: 'oshramar',
  },
  {
    firstName: 'בן',
    lastName: 'הרגס',
    displayName: 'בן',
    phone: '050-0000020',
    positionCode: 3,
    courtCode: 'BAT_YAM',
    email: 'benharges@gmail.com',
    password: 'benharges',
  },
  {
    firstName: 'יוחאי',
    lastName: 'אוחיון',
    displayName: 'יוחאי',
    phone: '050-0000021',
    positionCode: 3,
    courtCode: 'BAT_YAM',
    email: 'yochaiohayon@gmail.com',
    password: 'yochaiohayon',
  },
  {
    firstName: 'אילה',
    lastName: 'גין',
    displayName: 'אילה',
    phone: '050-0000022',
    positionCode: 4,
    courtCode: 'BAT_YAM',
    email: 'ayalagin@gmail.com',
    password: 'ayalagin',
  },
  {
    firstName: 'ניק',
    lastName: 'שבדש',
    displayName: 'ניק',
    phone: '050-0000023',
    positionCode: 4,
    courtCode: 'BAT_YAM',
    email: 'nikshabdush@gmail.com',
    password: 'nikshabdush',
  },
  {
    firstName: 'שני',
    lastName: 'פנחס',
    displayName: 'שני',
    phone: '050-0000024',
    positionCode: 4,
    courtCode: 'BAT_YAM',
    email: 'shaniphenchas@gmail.com',
    password: 'shaniphenchas',
  },
];

const ALL_SHIFT_TYPES = [ShiftType.MORNING, ShiftType.EVENING, ShiftType.NIGHT] as const;

const ALL_DAY_CATEGORIES = [
  DayCategory.WEEKDAY,
  DayCategory.FRIDAY,
  DayCategory.SATURDAY,
  DayCategory.HOLIDAY,
] as const;

function defaultAmountForPosition(positionCode: number) {
  switch (positionCode) {
    case 1:
      return 0; // קצין מתקן לא חייב להופיע בכל משמרת
    case 2:
      return 1; // אחמ״ש
    case 3:
      return 1; // בקר
    case 4:
      return 2; // מאבטחים
    default:
      return 1;
  }
}

const SHIFT_CAPACITIES: ShiftCapacitySeed[] = COURTS.flatMap((court) =>
  ALL_SHIFT_TYPES.flatMap((shiftType) =>
    ALL_DAY_CATEGORIES.flatMap((dayCategory) =>
      POSITIONS.map((position) => ({
        courtCode: court.code,
        positionCode: position.code,
        shiftType,
        dayCategory,
        amount: defaultAmountForPosition(position.code),
        displayOrder: position.displayOrder,
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

  await prisma.shiftCapacity.deleteMany();

  await prisma.schedulePeriod.deleteMany();

  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  await prisma.employee.deleteMany();
  await prisma.position.deleteMany();

  await prisma.court.deleteMany();
  await prisma.region.deleteMany();

  await prisma.verificationToken.deleteMany();
  await prisma.systemConfig.deleteMany();
}

async function seedRegionsAndCourts() {
  const regionIdByCode = new Map<string, string>();

  for (const region of REGIONS) {
    const createdRegion = await prisma.region.create({
      data: {
        name: region.name,
        code: region.code,
      },
    });

    regionIdByCode.set(region.code, createdRegion.id);
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

async function seedPositions() {
  const courts = await prisma.court.findMany();

  for (const court of courts) {
    await prisma.position.createMany({
      data: POSITIONS.map((position) => ({
        courtId: court.id,
        code: position.code,
        name: position.name,
        isActive: true,
      })),
    });
  }
}

async function seedEmployeesAndUsers() {
  for (const emp of EMPLOYEES) {
    const court = await prisma.court.findUnique({
      where: {
        code: emp.courtCode,
      },
    });

    if (!court) {
      throw new Error(`Court not found for employee: ${emp.email}`);
    }

    const position = await prisma.position.findFirst({
      where: {
        courtId: court.id,
        code: emp.positionCode,
      },
    });

    if (!position) {
      throw new Error(
        `Position not found for employee: ${emp.email}. courtCode=${emp.courtCode}, positionCode=${emp.positionCode}`,
      );
    }

    const employee = await prisma.employee.create({
      data: {
        firstName: emp.firstName,
        lastName: emp.lastName,
        displayName: emp.displayName,
        phone: emp.phone ?? null,
        positionId: position.id,
        courtId: court.id,
        isActive: true,
        isReligious: emp.isReligious ?? false,
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

async function seedShiftCapacities() {
  for (const capacity of SHIFT_CAPACITIES) {
    const court = await prisma.court.findUnique({
      where: {
        code: capacity.courtCode,
      },
    });

    if (!court) {
      throw new Error(`Court not found for shift capacity: ${capacity.courtCode}`);
    }

    const position = await prisma.position.findFirst({
      where: {
        courtId: court.id,
        code: capacity.positionCode,
      },
    });

    if (!position) {
      throw new Error(
        `Position not found for shift capacity. courtCode=${capacity.courtCode}, positionCode=${capacity.positionCode}`,
      );
    }

    await prisma.shiftCapacity.create({
      data: {
        courtId: court.id,
        positionId: position.id,
        shiftType: capacity.shiftType,
        dayCategory: capacity.dayCategory,
        amount: capacity.amount,
        isActive: true,
        displayOrder: capacity.displayOrder,
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

  console.log('🧩 Seeding positions...');
  await seedPositions();
  console.log('✅ Positions seeded');

  console.log('👥 Seeding employees and users...');
  await seedEmployeesAndUsers();
  console.log('✅ Employees and users seeded');

  console.log('📐 Seeding shift capacities...');
  await seedShiftCapacities();
  console.log('✅ Shift capacities seeded');

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
