import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';
import { PrismaClient, SystemRole, ShiftType, DayCategory } from '../src/generated/prisma/client';
import { BAT_YAM_EMPLOYEES } from './data';
import { DEFAULT_SHIFT_TIMES } from '../src/features/schedules/shift-times';

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
  rank: number;
  name: string;
};

type EmployeeSeed = {
  firstName: string;
  lastName: string;
  displayName: string;
  phone?: string;
  positionRank: number;
  facilityCode: string;
  email: string;
  password: string;
  isReligious?: boolean;
  systemRole?: SystemRole;
  isManager?: boolean;
  mustChangePassword?: boolean;
};

type StaffingRequirementSeed = {
  facilityCode: string;
  positionRank: number;
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
  { rank: 1, name: 'קצין מתקן' },
  { rank: 2, name: 'אחמ״ש' },
  { rank: 3, name: 'בקר' },
  { rank: 4, name: 'מאבטח' },
];

const EMPLOYEES: EmployeeSeed[] = BAT_YAM_EMPLOYEES;
const ALL_SHIFT_TYPES = [ShiftType.MORNING, ShiftType.EVENING, ShiftType.NIGHT] as const;

const ALL_DAY_CATEGORIES = [
  DayCategory.WEEKDAY,
  DayCategory.FRIDAY,
  DayCategory.SATURDAY,
] as const;

function defaultRequiredCountForPosition(positionRank: number) {
  switch (positionRank) {
    case 2:
      return 2; // אחמ״ש
    case 3:
      return 3; // בקר
    case 4:
      return 3; // מאבטחים
    default:
      return 1;
  }
}

const SHIFT_CAPACITIES: StaffingRequirementSeed[] = COURTS.flatMap((court) =>
  ALL_SHIFT_TYPES.flatMap((shiftType) =>
    ALL_DAY_CATEGORIES.flatMap((dayCategory) =>
      POSITIONS.filter((position) => position.name !== 'קצין מתקן').map((position) => ({
        facilityCode: court.code,
        positionRank: position.rank,
        shiftType,
        dayCategory,
        requiredCount: defaultRequiredCountForPosition(position.rank),
        displayOrder: position.rank,
      })),
    ),
  ),
);
async function clearDatabase() {
  if (await prisma.user.count() || await prisma.facility.count()) {
    throw new Error('Seed requires an empty development database. Published history cannot be cleared by seed.');
  }
}

async function seedRegionsAndCourts() {
  const districtIdByCode = new Map<string, string>();

  for (const region of REGIONS) {
    const createdRegion = await prisma.district.create({
      data: {
        name: region.name,
        code: region.code,
      },
    });

    districtIdByCode.set(region.code, createdRegion.id);
  }

  for (const court of COURTS) {
    const districtId = districtIdByCode.get(court.regionCode);

    if (!districtId) {
      throw new Error(`Region not found: ${court.regionCode}`);
    }

    await prisma.facility.create({
      data: {
        name: court.name,
        code: court.code,
        districtId,
        shiftTimes: { create: DEFAULT_SHIFT_TIMES },
      },
    });
  }
}

async function seedPositions() {
  // Global roles (facilityId null), shared by all facilities.
  await prisma.shiftRole.createMany({
    data: POSITIONS.map((position) => ({
      facilityId: null,
      rank: position.rank,
      name: position.name,
      isActive: true,
    })),
  });
}

async function seedEmployeesAndUsers() {
  for (const emp of EMPLOYEES) {
    const court = await prisma.facility.findUnique({
      where: {
        code: emp.facilityCode,
      },
    });

    if (!court) {
      throw new Error(`Court not found for employee: ${emp.email}`);
    }

    const position = await prisma.shiftRole.findFirst({
      where: {
        facilityId: null,
        rank: emp.positionRank,
      },
    });

    if (!position) {
      throw new Error(
        `Position not found for employee: ${emp.email}. facilityCode=${emp.facilityCode}, positionRank=${emp.positionRank}`,
      );
    }

    const passwordHash = await bcrypt.hash(emp.password, 10);

    await prisma.user.create({
      data: {
        email: emp.email,
        passwordHash,
        systemRole: emp.systemRole ?? SystemRole.USER,
        facilityRoles: emp.isManager ? { create: { facilityId: court.id, role: 'MANAGER' } } : undefined,
        mustChangePassword: emp.mustChangePassword ?? false,
        firstName: emp.firstName,
        lastName: emp.lastName,
        displayName: emp.displayName,
        phone: emp.phone ?? null,
        shiftRoleId: position.id,
        facilityId: court.id,
        isActive: true,
        isReligious: emp.isReligious ?? false,
      },
    });
  }
}

async function seedShiftCapacities() {
  for (const capacity of SHIFT_CAPACITIES) {
    const court = await prisma.facility.findUnique({
      where: {
        code: capacity.facilityCode,
      },
    });

    if (!court) {
      throw new Error(`Court not found for shift capacity: ${capacity.facilityCode}`);
    }

    const position = await prisma.shiftRole.findFirst({
      where: {
        facilityId: null,
        rank: capacity.positionRank,
      },
    });

    if (!position) {
      throw new Error(
        `Position not found for shift capacity. facilityCode=${capacity.facilityCode}, positionRank=${capacity.positionRank}`,
      );
    }

    await prisma.staffingRequirement.create({
      data: {
        facilityId: court.id,
        shiftRoleId: position.id,
        shiftType: capacity.shiftType,
        dayCategory: capacity.dayCategory,
        requiredCount: capacity.requiredCount,
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
