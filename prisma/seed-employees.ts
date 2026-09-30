import { seedCapability } from './seed-capability';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';
import { PrismaClient, SystemRole } from '../src/generated/prisma/client';
import { BAT_YAM_EMPLOYEES } from './data';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

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
  isManager?: boolean;
  mustChangePassword?: boolean;
};

type PositionSeed = {
  code: number;
  name: string;
  displayOrder: number;
  color?: string;
};

const EMPLOYEES: EmployeeSeed[] = BAT_YAM_EMPLOYEES;

const POSITION_BY_CODE: Record<number, PositionSeed> = {
  1: {
    code: 1,
    name: 'קצין מתקן',
    displayOrder: 1,
    color: '#2563eb',
  },
  2: {
    code: 2,
    name: 'אחמ״ש',
    displayOrder: 2,
    color: '#16a34a',
  },
  3: {
    code: 3,
    name: 'בקר',
    displayOrder: 3,
    color: '#64748b',
  },
  4: {
    code: 4,
    name: 'מאבטח',
    displayOrder: 4,
    color: '#dc2626',
  },
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function seedPositionsForEmployees(employees: EmployeeSeed[]) {
  const uniqueCourtPositionPairs = new Map<
    string,
    {
      courtCode: string;
      positionCode: number;
    }
  >();

  for (const emp of employees) {
    const key = `${emp.courtCode}:${emp.positionCode}`;

    uniqueCourtPositionPairs.set(key, {
      courtCode: emp.courtCode,
      positionCode: emp.positionCode,
    });
  }

  for (const item of uniqueCourtPositionPairs.values()) {
    const court = await prisma.facility.findUnique({
      where: {
        code: item.courtCode,
      },
    });

    if (!court) {
      throw new Error(`Court not found for position seed: ${item.courtCode}`);
    }

    const positionData = POSITION_BY_CODE[item.positionCode];

    if (!positionData) {
      throw new Error(
        `Missing POSITION_BY_CODE config for positionCode=${item.positionCode}, courtCode=${item.courtCode}`,
      );
    }

    await prisma.shiftRole.upsert({
      where: {
        facilityId_code: {
          facilityId: court.id,
          code: positionData.code,
        },
      },
      update: {
        name: positionData.name,
        requiredCapability: seedCapability(positionData.code),
        displayOrder: positionData.displayOrder,
        color: positionData.color ?? null,
        isActive: true,
      },
      create: {
        facilityId: court.id,
        code: positionData.code,
        name: positionData.name,
        requiredCapability: seedCapability(positionData.code),
        displayOrder: positionData.displayOrder,
        color: positionData.color ?? null,
        isActive: true,
      },
    });

    console.log(`Seeded position: ${positionData.name} | court=${item.courtCode} | code=${positionData.code}`);
  }

  console.log('✅ Positions seeded successfully');
}

async function main() {
  await seedPositionsForEmployees(EMPLOYEES);

  for (const emp of EMPLOYEES) {
    const court = await prisma.facility.findUnique({
      where: {
        code: emp.courtCode,
      },
    });

    if (!court) {
      throw new Error(`Court not found for employee: ${emp.email}`);
    }

    const position = await prisma.shiftRole.findFirst({
      where: {
        facilityId: court.id,
        code: emp.positionCode,
      },
    });

    if (!position) {
      throw new Error(
        `Position not found for employee: ${emp.email}. courtCode=${emp.courtCode}, positionCode=${emp.positionCode}`,
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: emp.email,
      },
    });

    if (existingUser) {
      console.log(`Skipping existing user: ${emp.email}`);
      continue;
    }

    const employee = await prisma.employee.create({
      data: {
        firstName: emp.firstName,
        lastName: emp.lastName,
        displayName: emp.displayName,
        phone: emp.phone ?? null,
        primaryShiftRoleId: position.id,
        capability: seedCapability(emp.positionCode),
        facilityId: court.id,
        isActive: true,
        isReligious: emp.isReligious ?? false,
      },
    });

    const passwordHash = await bcrypt.hash(emp.password, 10);

    await prisma.user.create({
      data: {
        email: emp.email,
        passwordHash,
        systemRole: SystemRole.USER,
        facilityRoles: emp.isManager ? { create: { facilityId: court.id, role: 'MANAGER' } } : undefined,
        mustChangePassword: emp.mustChangePassword ?? false,
        employeeId: employee.id,
      },
    });

    console.log(`Created employee and user: ${emp.email}`);
  }

  console.log('✅ Bat Yam employees seeded successfully');
}

main()
  .catch(async (error) => {
    console.error('❌ Seed Bat Yam failed');
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
