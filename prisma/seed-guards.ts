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

const courtCodes = ['SHOKEN', 'VAITZMAN', 'JERUSALEM'];

const employeesByCourt: Record<string, { name: string; position: Position }[]> = {
  SHOKEN: [
    { name: 'ליאון ארול', position: Position.SHIFT_MANAGER },
    { name: 'דוד ביטון', position: Position.BAKAR },
    { name: 'יוני מגן', position: Position.GUARD },
    { name: 'אביטל כהן', position: Position.GUARD },
    { name: 'שני לוי', position: Position.GUARD },
  ],
  VAITZMAN: [
    { name: 'נועם לונדובסקי', position: Position.SHIFT_MANAGER },
    { name: 'ניסים לוטינגר', position: Position.BAKAR },
    { name: 'אבי יונסו', position: Position.GUARD },
    { name: 'לוטן מלכה', position: Position.GUARD },
    { name: 'מאיר בורשטיין', position: Position.GUARD },
  ],
  JERUSALEM: [
    { name: 'יואב בטרון', position: Position.SHIFT_MANAGER },
    { name: 'גל אביעד', position: Position.BAKAR },
    { name: 'אבינועם פלורי', position: Position.GUARD },
    { name: 'שרון חגואל', position: Position.GUARD },
    { name: 'דוד ברק', position: Position.GUARD },
  ],
};

async function main() {
  let empNumberCounter = 2000;
  let employeeCodeCounter = 200;

  for (const code of courtCodes) {
    const court = await prisma.court.findUnique({ where: { code } });
    if (!court) {
      console.warn(`Court "${code}" not found — skipping`);
      continue;
    }

    const employees = employeesByCourt[code] ?? [];
    for (const emp of employees) {
      const employeeNumber = String(empNumberCounter++);
      const passwordHash = await bcrypt.hash(employeeNumber, 12);

      const employee = await prisma.employee.create({
        data: {
          name: emp.name,
          position: emp.position,
          primaryCourtId: court.id,
          employeeCode: `EMP-${employeeCodeCounter++}`,
          isActive: true,
        },
      });

      await prisma.user.create({
        data: {
          employeeNumber,
          passwordHash,
          systemRole: SystemRole.EMPLOYEE,
          mustChangePassword: true,
          isActive: true,
          employeeId: employee.id,
        },
      });

      await prisma.courtEligibility.create({
        data: { employeeId: employee.id, courtId: court.id },
      });

      console.log(`Created guard ${emp.name} (${employeeNumber}) for court ${code}`);
    }
  }
}

main()
  .then(() => {
    console.log('Guards seeding completed!');
    return prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
