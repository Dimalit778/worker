import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';
import { PrismaClient, SystemRole } from '../src/generated/prisma/client';
import { VAITZMAN_EMPLOYEES } from './data';

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
  systemRole?: SystemRole;
  mustChangePassword?: boolean;
};

const EMPLOYEES: EmployeeSeed[] = VAITZMAN_EMPLOYEES;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function main() {
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

    console.log(`Created employee and user: ${emp.email}`);
  }

  console.log('✅ Vaitzman employees seeded successfully');
}

main()
  .catch(async (error) => {
    console.error('❌ Seed Vaitzman failed');
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
