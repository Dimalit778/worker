import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/client';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set (check .env or .env.local)');

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const REGIONS = [
  { name: 'מחוז ירושלים', code: 'JERUSALEM' },
  { name: 'מחוז תל אביב', code: 'TEL_AVIV' },
  { name: 'מחוז חיפה', code: 'HAIFA' },
  { name: 'מחוז מרכז', code: 'CENTER' },
];

type CourtSeed = { name: string; code: string; regionCode: string };

const COURTS: CourtSeed[] = [
  { name: 'בית משפט מחוזי ירושלים', code: 'JERUSALEM', regionCode: 'JERUSALEM' },
  { name: 'בית משפט מחוזי תל אביב (ויצמן)', code: 'VAITZMAN', regionCode: 'TEL_AVIV' },
  { name: 'בית משפט שוקן', code: 'SHOKEN', regionCode: 'TEL_AVIV' },
  { name: 'בית משפט שלום בת ים', code: 'BAT_YAM', regionCode: 'TEL_AVIV' },
  { name: 'בית משפט ראשון לציון', code: 'RISHON', regionCode: 'CENTER' },
];

async function main() {
  console.log('Seeding regions and courts...');

  const regionIds = new Map<string, string>();

  for (const region of REGIONS) {
    const record = await prisma.region.upsert({
      where: { code: region.code },
      update: { name: region.name },
      create: region,
    });
    regionIds.set(region.code, record.id);
    console.log(`Region: ${record.name} (${record.code})`);
  }

  for (const court of COURTS) {
    const regionId = regionIds.get(court.regionCode);
    if (!regionId) throw new Error(`Region not found for code: ${court.regionCode}`);

    const record = await prisma.court.upsert({
      where: { code: court.code },
      update: { name: court.name, regionId },
      create: { name: court.name, code: court.code, regionId },
    });
    console.log(`Court: ${record.name} (${record.code})`);
  }

  console.log(`\nDone — ${REGIONS.length} regions, ${COURTS.length} courts`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
