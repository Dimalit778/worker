import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';
import { PrismaClient, SystemRole } from '../src/generated/prisma/client';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

async function main() {
  const passwordHash = await bcrypt.hash('tomer123', 10);

  // 1. יצירת מחוז תל אביב
  const region = await prisma.region.upsert({
    where: {
      code: 'TEL_AVIV',
    },
    update: {
      name: 'מחוז תל אביב',
    },
    create: {
      name: 'מחוז תל אביב',
      code: 'TEL_AVIV',
    },
  });

  // 2. יצירת בית משפט השלום בת ים
  const court = await prisma.court.upsert({
    where: {
      code: 'BAT_YAM',
    },
    update: {
      name: 'בית משפט השלום בת ים',
      regionId: region.id,
    },
    create: {
      name: 'בית משפט השלום בת ים',
      code: 'BAT_YAM',
      regionId: region.id,
    },
  });

  // 3. יצירת Position/Role של מנהל בבית המשפט
  const managerPosition = await prisma.position.upsert({
    where: {
      courtId_name: {
        courtId: court.id,
        name: 'מנהל',
      },
    },
    update: {
      name: 'מנהל',
      isActive: true,
      displayOrder: 1,
    },
    create: {
      courtId: court.id,
      name: 'מנהל',
      isActive: true,
      displayOrder: 1,
    },
  });

  // 4. יצירת Employee של תומר לוי
  const employee = await prisma.employee.create({
    data: {
      firstName: 'תומר',
      lastName: 'לוי',
      phone: null,
      courtId: court.id,
      positionId: managerPosition.id,
      isActive: true,
    },
  });

  // 5. יצירת User עם role של MANAGER
  await prisma.user.create({
    data: {
      email: 'tomerlevy@gmail.com',
      passwordHash,
      systemRole: SystemRole.MANAGER,
      mustChangePassword: false,
      employeeId: employee.id,
    },
  });

  console.log('✅ Minimal manager seed completed');
  console.log({
    region: region.name,
    court: court.name,
    position: managerPosition.name,
    managerName: 'תומר לוי',
    email: 'tomer123@gmail.com',
    password: 'tomer123',
    systemRole: SystemRole.MANAGER,
  });
}

main()
  .catch(async (error) => {
    console.error('❌ Minimal manager seed failed');
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
