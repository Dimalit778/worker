import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import bcrypt from 'bcryptjs';
import { Position, PrismaClient, SystemRole } from '../src/generated/prisma/client';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set (check .env or .env.local)');

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const managersByCourt: {
  courtCode: string;
  name: string;
  email: string;
  employeeNumber: string;
  employeeCode: string;
  password: string;
}[] = [
  //   {
  //     courtCode: 'BAT_YAM',
  //     name: 'תומר לוי',
  //     email: 'tomer@gmail.com',
  //     employeeNumber: '1001',
  //     employeeCode: 'MGR-001',
  //     password: 'tomer123',
  //   },
  {
    courtCode: 'VAITZMAN',
    name: 'מיכל כהן',
    email: 'michal@gmail.com',
    employeeNumber: '9002',
    employeeCode: 'MGR-002',
    password: 'michal123',
  },
  {
    courtCode: 'SHOKEN',
    name: 'אבי שפירא',
    email: 'avi@gmail.com',
    employeeNumber: '9003',
    employeeCode: 'MGR-003',
    password: 'avi123',
  },
  {
    courtCode: 'JERUSALEM',
    name: 'רונית אברהם',
    email: 'ronit@gmail.com',
    employeeNumber: '9004',
    employeeCode: 'MGR-004',
    password: 'ronit123',
  },
];

async function main() {
  for (const mgr of managersByCourt) {
    const court = await prisma.court.findUnique({ where: { code: mgr.courtCode } });
    if (!court) {
      console.warn(`Court "${mgr.courtCode}" not found — skipping`);
      continue;
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: mgr.email }, { employeeNumber: mgr.employeeNumber }] },
    });
    if (existing) {
      console.log(`Manager ${mgr.name} already exists — skipping`);
      continue;
    }

    const passwordHash = await bcrypt.hash(mgr.password, 12);

    const employee = await prisma.employee.create({
      data: {
        name: mgr.name,
        position: Position.SHIFT_MANAGER,
        primaryCourtId: court.id,
        employeeCode: mgr.employeeCode,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: mgr.email,
        employeeNumber: mgr.employeeNumber,
        passwordHash,
        systemRole: SystemRole.MANAGER,
        mustChangePassword: false,
        isActive: true,
        employeeId: employee.id,
      },
    });

    await prisma.courtEligibility.create({
      data: { employeeId: employee.id, courtId: court.id },
    });

    console.log(`Created manager ${mgr.name} (${mgr.employeeNumber}) for court ${mgr.courtCode}`);
  }
}

main()
  .then(() => {
    console.log('Managers seeding completed!');
    return prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
