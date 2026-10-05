import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/client';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

const DISTRICTS = [
  {
    name: 'מחוז תל אביב',
    code: 'TEL_AVIV',
    facilities: [
      { name: 'שוקן', code: 'SHOKEN' },
      { name: 'בת ים', code: 'BAT_YAM' },
      { name: 'ויצמן', code: 'VAITZMAN' },
      { name: 'הרצליה', code: 'HERZLIYA' },
    ],
  },
  {
    name: 'מחוז מרכז',
    code: 'CENTER',
    facilities: [
      { name: 'ראשון לציון', code: 'RISHON' },
      { name: 'כפר סבא', code: 'KFAR_SABA' },
      { name: 'פתח תקווה', code: 'PETAH_TIKVA' },
    ],
  },
  {
    name: 'מחוז צפון',
    code: 'NORTH',
    facilities: [
      { name: 'חיפה', code: 'HAIFA' },
      { name: 'נצרת', code: 'NAZARETH' },
    ],
  },
];

// Smaller rank means greater qualification: employeeRank <= requiredRank.
const BASE_POSITIONS = [
  { code: 'MANAGER', name: 'קצין מתקן', rank: 1 },
  { code: 'SHIFT_MANAGER', name: 'אחמ״ש', rank: 2 },
  { code: 'BAKAR', name: 'בקר', rank: 3 },
  { code: 'GUARD', name: 'מאבטח', rank: 4 },
] as const;

const SHIFTS = [
  { shiftType: 'MORNING', startTime: '07:00', endTime: '15:00', endDayOffset: 0 },
  { shiftType: 'EVENING', startTime: '15:00', endTime: '23:00', endDayOffset: 0 },
  { shiftType: 'NIGHT', startTime: '23:00', endTime: '07:00', endDayOffset: 1 },
] as const;

async function main() {
  // Commit the complete facility setup together, or roll back on error.
  await prisma.$transaction(
    async (tx) => {
      // One shared row per base role, independent of the number of facilities.
      for (const position of BASE_POSITIONS) {
        const role = await tx.role.upsert({
          where: { code: position.code },
          update: {},
          create: position,
        });
        await tx.position.upsert({
          where: { baseRoleId: role.id },
          update: {},
          create: {
            name: role.name, baseRoleId: role.id, facilityId: null,
            requiredRank: role.rank, displayOrder: role.rank,
          },
        });
      }

      for (const { facilities, ...district } of DISTRICTS) {
        const savedDistrict = await tx.district.upsert({
          where: { code: district.code },
          update: { name: district.name },
          create: district,
        });

        for (const facility of facilities) {
          const data = { ...facility, districtId: savedDistrict.id };
          const savedFacility = await tx.facility.upsert({
            where: { code: facility.code },
            update: { name: facility.name, districtId: savedDistrict.id },
            create: data,
          });
          const facilityId = savedFacility.id;

          // Re-running preserves existing local shift hours.
          await tx.facilityShift.createMany({
            data: SHIFTS.map((shift) => ({ ...shift, facilityId })),
            skipDuplicates: true,
          });
        }
      }
    },
    { timeout: 60_000 },
  );

  console.log('Seed complete: 3 districts, 9 facilities, with 4 shared base positions and local shift hours.');
  console.log('Existing records outside this list were not deleted. No users or schedules were created.');
}

main()
  .catch((error: unknown) => {
    console.error('District/facility seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
