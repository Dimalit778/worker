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
  phoneNumber?: string;
  roleCode: string;
  facilityCode: string;
  email: string;
  password: string;
  isReligious?: boolean;
  canEditSchedule?: boolean;
};

type RoleSeed = {
  code: string;
  name: string;
  rank: number;
};

const EMPLOYEES: EmployeeSeed[] = BAT_YAM_EMPLOYEES;

const ROLES: RoleSeed[] = [
  { code: 'MANAGER', name: 'קצין מתקן', rank: 1 },
  { code: 'SHIFT_MANAGER', name: 'אחמ״ש', rank: 2 },
  { code: 'BAKAR', name: 'בקר', rank: 3 },
  { code: 'GUARD', name: 'מאבטח', rank: 4 },
];

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function seedRoles() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name, rank: role.rank },
      create: role,
    });

    console.log(`Seeded role: ${role.name} | code=${role.code}`);
  }

  console.log('✅ Roles seeded successfully');
}

async function main() {
  await seedRoles();

  for (const emp of EMPLOYEES) {
    const court = await prisma.facility.findUnique({
      where: {
        code: emp.facilityCode,
      },
    });

    if (!court) {
      throw new Error(`Court not found for employee: ${emp.email}`);
    }

    const role = await prisma.role.findUnique({
      where: {
        code: emp.roleCode,
      },
    });

    if (!role) {
      throw new Error(
        `Role not found for employee: ${emp.email}. facilityCode=${emp.facilityCode}, roleCode=${emp.roleCode}`,
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: emp.email,
      },
    });

    if (existingUser) {
      if (emp.phoneNumber && existingUser.phoneNumber !== emp.phoneNumber) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { phoneNumber: emp.phoneNumber },
        });
        console.log(`Updated phone for existing user: ${emp.email}`);
      } else {
        console.log(`Skipping existing user: ${emp.email}`);
      }
      continue;
    }

    const passwordHash = await bcrypt.hash(emp.password, 10);

    await prisma.user.create({
      data: {
        email: emp.email,
        passwordHash,
        systemRole: SystemRole.USER,
        firstName: emp.firstName,
        lastName: emp.lastName,
        displayName: emp.displayName,
        phoneNumber: emp.phoneNumber ?? null,
        roleId: role.id,
        facilityId: court.id,
        canEditSchedule: emp.canEditSchedule ?? emp.roleCode === 'MANAGER',
        isReligious: emp.isReligious ?? false,
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
