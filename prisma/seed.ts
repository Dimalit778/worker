import { resolve } from 'node:path';

import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';

import { Position, PrismaClient, SystemRole } from '../src/generated/prisma/client';
import { REGIONS, COURTS, EMPLOYEES } from './data';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set (check .env or .env.local)');
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function clearDatabase() {
  await prisma.scheduleWarning.deleteMany();
  await prisma.shiftAssignment.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.availabilityEntry.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.fairnessRecord.deleteMany();
  await prisma.schedulingPeriod.deleteMany();
  await prisma.courtShiftRule.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.court.deleteMany();
  await prisma.region.deleteMany();
}
async function seedRegionsAndCourts() {
  console.log('Seeding regions and courts...');

  const regionIds = new Map<string, string>();

  for (const region of REGIONS) {
    const record = await prisma.region.create({
      data: region,
    });
    regionIds.set(region.code, record.id);
    console.log(`Region: ${record.name} (${record.code})`);
  }

  for (const court of COURTS) {
    const regionId = regionIds.get(court.regionCode);
    if (!regionId) {
      throw new Error(`Region not found for code: ${court.regionCode}`);
    }

    const record = await prisma.court.create({
      data: {
        name: court.name,
        code: court.code,
        regionId,
      },
    });

    console.log(`Court: ${record.name} (${record.code})`);
  }
}

async function seedEmployeesAndUsers() {
  console.log('Seeding employees and users...');

  for (const emp of EMPLOYEES) {
    const court = await prisma.court.findUnique({
      where: { code: emp.courtCode },
    });

    if (!court) {
      console.warn(`Court "${emp.courtCode}" not found — skipping ${emp.firstName} ${emp.lastName}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(emp.password, 12);

    const employee = await prisma.employee.create({
      data: {
        firstName: emp.firstName,
        lastName: emp.lastName,
        phone: emp.phone ?? null,
        position: emp.position,
        courtId: court.id,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: emp.email,
        passwordHash,
        systemRole: emp.systemRole ?? SystemRole.EMPLOYEE,
        mustChangePassword: emp.mustChangePassword ?? false,
        employeeId: employee.id,
      },
    });

    console.log(`Created ${emp.firstName} ${emp.lastName} for ${emp.courtCode}`);
  }
}

async function main() {
  console.log('Clearing existing data...');
  await clearDatabase();
  console.log('Existing data cleared');

  await seedRegionsAndCourts();
  await seedEmployeesAndUsers();

  console.log(`Done — ${REGIONS.length} regions, ${COURTS.length} courts, ${EMPLOYEES.length} employees/users`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
