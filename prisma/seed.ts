import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';
import { PrismaClient, SystemRole, ShiftType, DayCategory } from '../src/generated/prisma/client';
import { BAT_YAM_EMPLOYEES } from './data';

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

type StaffingRequirementSeed = {
  courtCode: string;
  positionCode: number;
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

const EMPLOYEES: EmployeeSeed[] = BAT_YAM_EMPLOYEES;
const ALL_SHIFT_TYPES = [ShiftType.MORNING, ShiftType.EVENING, ShiftType.NIGHT] as const;

const ALL_DAY_CATEGORIES = [
  DayCategory.WEEKDAY,
  DayCategory.FRIDAY,
  DayCategory.SATURDAY,
  DayCategory.HOLIDAY,
] as const;

function defaultRequiredCountForPosition(positionCode: number) {
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

const STAFFING_REQUIREMENTS: StaffingRequirementSeed[] = COURTS.flatMap((court) =>
  ALL_SHIFT_TYPES.flatMap((shiftType) =>
    ALL_DAY_CATEGORIES.flatMap((dayCategory) =>
      POSITIONS.map((position) => ({
        courtCode: court.code,
        positionCode: position.code,
        shiftType,
        dayCategory,
        requiredCount: defaultRequiredCountForPosition(position.code),
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

  await prisma.availabilitySlot.deleteMany();
  await prisma.availabilitySubmission.deleteMany();

  await prisma.fairnessRecord.deleteMany();

  await prisma.staffingRequirement.deleteMany();

  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.userPermission.deleteMany();
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

async function seedStaffingRequirements() {
  for (const requirement of STAFFING_REQUIREMENTS) {
    const court = await prisma.court.findUnique({
      where: {
        code: requirement.courtCode,
      },
    });

    if (!court) {
      throw new Error(`Court not found for staffing requirement: ${requirement.courtCode}`);
    }

    const position = await prisma.position.findFirst({
      where: {
        courtId: court.id,
        code: requirement.positionCode,
      },
    });

    if (!position) {
      throw new Error(
        `Position not found for staffing requirement. courtCode=${requirement.courtCode}, positionCode=${requirement.positionCode}`,
      );
    }

    await prisma.staffingRequirement.create({
      data: {
        courtId: court.id,
        positionId: position.id,
        shiftType: requirement.shiftType,
        dayCategory: requirement.dayCategory,
        requiredCount: requirement.requiredCount,
        isActive: true,
        displayOrder: requirement.displayOrder,
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

  console.log('📐 Seeding staffing requirements...');
  await seedStaffingRequirements();
  console.log('✅ Staffing requirements seeded');

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
