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
}
type EmployeeSeed = {
  firstName: string;
  lastName: string;
  phone?: string;
  position: Position;
  courtCode: string;
  email: string;
  password: string;
  systemRole?: SystemRole;
  mustChangePassword?: boolean;
};

const EMPLOYEES: EmployeeSeed[] = [
  // ירושלים
  {
    firstName: 'אבי',
    lastName: 'כהן',
    phone: '050-0000001',
    position: Position.FACILITY_OFFICER,
    courtCode: 'JERUSALEM',
    email: 'avichoen@gmail.com',
    password: 'avi123',
    systemRole: SystemRole.MANAGER,
  },
  {
    firstName: 'דניאל',
    lastName: 'לוי',
    phone: '050-0000002',
    position: Position.SHIFT_MANAGER,
    courtCode: 'JERUSALEM',
    email: 'daniellevy@gmail.com',
    password: 'daniel123',
  },
  {
    firstName: 'רועי',
    lastName: 'מזרחי',
    phone: '050-0000003',
    position: Position.BAKAR,
    courtCode: 'JERUSALEM',
    email: 'roimizrahi@gmail.com',
    password: 'roi123',
  },
  {
    firstName: 'נועם',
    lastName: 'ביטון',
    phone: '050-0000004',
    position: Position.GUARD,
    courtCode: 'JERUSALEM',
    email: 'noambiton@gmail.com',
    password: 'noam123',
  },
  {
    firstName: 'שחר',
    lastName: 'אוחנה',
    phone: '050-0000005',
    position: Position.GUARD,
    courtCode: 'JERUSALEM',
    email: 'shaharohana@gmail.com',
    password: 'shahar123',
  },

  // ויצמן
  {
    firstName: 'אלרואי',
    lastName: 'מגידיש',
    phone: '050-0000006',
    position: Position.FACILITY_OFFICER,
    courtCode: 'VAITZMAN',
    email: 'elroimegidish@gmail.com',
    password: 'elroi123',
    systemRole: SystemRole.MANAGER,
  },
  {
    firstName: 'שוהם',
    lastName: 'מלכה',
    phone: '050-0000007',
    position: Position.SHIFT_MANAGER,
    courtCode: 'VAITZMAN',
    email: 'shohammalka@gmail.com',
    password: 'shoham123',
  },
  {
    firstName: 'איתי',
    lastName: 'שלום',
    phone: '050-0000008',
    position: Position.BAKAR,
    courtCode: 'VAITZMAN',
    email: 'itaishalom@gmail.com',
    password: 'itai123',
  },
  {
    firstName: 'אתי',
    lastName: 'לולה',
    phone: '050-0000009',
    position: Position.GUARD,
    courtCode: 'VAITZMAN',
    email: 'etilola@gmail.com',
    password: 'etil123',
  },
  {
    firstName: 'בן',
    lastName: 'חיים',
    phone: '050-0000010',
    position: Position.GUARD,
    courtCode: 'VAITZMAN',
    email: 'benhaim@gmail.com',
    password: 'ben123',
  },

  // שוקן
  {
    firstName: 'אסף',
    lastName: 'גולן',
    phone: '050-0000011',
    position: Position.FACILITY_OFFICER,
    courtCode: 'SHOKEN',
    email: 'asafgolan@gmail.com',
    password: 'asaf123',
    systemRole: SystemRole.MANAGER,
  },
  {
    firstName: 'אופיר',
    lastName: 'דוד',
    phone: '050-0000012',
    position: Position.SHIFT_MANAGER,
    courtCode: 'SHOKEN',
    email: 'ofirdavid@gmail.com',
    password: 'ofir123',
  },
  {
    firstName: 'ליאור',
    lastName: 'סבן',
    phone: '050-0000013',
    position: Position.BAKAR,
    courtCode: 'SHOKEN',
    email: 'liorsaban@gmail.com',
    password: 'lior123',
  },
  {
    firstName: 'עידן',
    lastName: 'אמסלם',
    phone: '050-0000014',
    position: Position.GUARD,
    courtCode: 'SHOKEN',
    email: 'idanamsalem@gmail.com',
    password: 'idan123',
  },

  // בת ים
  {
    firstName: 'תומר',
    lastName: 'לוי',
    phone: '050-0000015',
    position: Position.FACILITY_OFFICER,
    courtCode: 'BAT_YAM',
    email: 'tomerlevi@gmail.com',
    password: 'tomer123',
    systemRole: SystemRole.MANAGER,
  },
  {
    firstName: 'דימה',
    lastName: 'ליטבינוב',
    phone: '050-0000016',
    position: Position.SHIFT_MANAGER,
    courtCode: 'BAT_YAM',
    email: 'dimalit@gmail.com',
    password: 'dima123',
  },
  {
    firstName: 'דימה',
    lastName: 'גוכמן',
    phone: '050-0000017',
    position: Position.SHIFT_MANAGER,
    courtCode: 'BAT_YAM',
    email: 'dimagofman@gmail.com',
    password: 'dima123',
  },
  {
    firstName: 'איב',
    lastName: 'לוי',
    phone: '050-0000018',
    position: Position.SHIFT_MANAGER,
    courtCode: 'BAT_YAM',
    email: 'evelevi@gmail.com',
    password: 'eve123',
  },
  {
    firstName: 'אושר',
    lastName: 'עמר',
    phone: '050-0000019',
    position: Position.BAKAR,
    courtCode: 'BAT_YAM',
    email: 'oshramar@gmail.com',
    password: 'oshr123',
  },
  {
    firstName: 'בן',
    lastName: 'הרגס',
    phone: '050-0000020',
    position: Position.BAKAR,
    courtCode: 'BAT_YAM',
    email: 'benharges@gmail.com',
    password: 'ben123',
  },
  {
    firstName: 'יוחאי',
    lastName: 'אוחיון',
    phone: '050-0000021',
    position: Position.BAKAR,
    courtCode: 'BAT_YAM',
    email: 'yochaiohayon@gmail.com',
    password: 'yochai123',
  },
  {
    firstName: 'אילה',
    lastName: 'גין',
    phone: '050-0000022',
    position: Position.GUARD,
    courtCode: 'BAT_YAM',
    email: 'ayalagin@gmail.com',
    password: 'ayala123',
  },
  {
    firstName: 'ניק',
    lastName: 'שבדש',
    phone: '050-0000023',
    position: Position.GUARD,
    courtCode: 'BAT_YAM',
    email: 'nikshabdush@gmail.com',
    password: 'nik123',
  },
  {
    firstName: 'שני',
    lastName: 'פנחס',
    phone: '050-0000024',
    position: Position.GUARD,
    courtCode: 'BAT_YAM',
    email: 'shaniphenchas@gmail.com',
    password: 'shani123',
  },
];
async function main() {
  console.log('Clearing existing data...');
  await clearDatabase();
  console.log('Existing data cleared');

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

  console.log('Seed completed successfully');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
