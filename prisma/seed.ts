import { resolve } from 'node:path'

import { config } from 'dotenv'
import { PrismaNeon } from '@prisma/adapter-neon'
import bcrypt from 'bcryptjs'

import { PrismaClient, Role, ShiftType } from '../src/generated/prisma/client'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set (check .env or .env.local)')
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
})

async function main() {
  console.log('Seeding database...')

  // SystemConfig
  await prisma.systemConfig.upsert({
    where: { key: 'weekly_min_morning' },
    update: {},
    create: { key: 'weekly_min_morning', value: 2 },
  })
  await prisma.systemConfig.upsert({
    where: { key: 'weekly_min_evening' },
    update: {},
    create: { key: 'weekly_min_evening', value: 1 },
  })
  await prisma.systemConfig.upsert({
    where: { key: 'fairness_weights' },
    update: {},
    create: { key: 'fairness_weights', value: { W1: 3, W2: 2, W3: 1, W4: 1 } },
  })
  await prisma.systemConfig.upsert({
    where: { key: 'fairness_shift_threshold' },
    update: {},
    create: { key: 'fairness_shift_threshold', value: 2 },
  })
  await prisma.systemConfig.upsert({
    where: { key: 'fairness_opening_duty_threshold' },
    update: {},
    create: { key: 'fairness_opening_duty_threshold', value: 2 },
  })

  // Courts
  const courtA = await prisma.court.upsert({
    where: { code: 'DISTRICT_CENTER' },
    update: {},
    create: { name: 'בית משפט מחוזי – מרכז', code: 'DISTRICT_CENTER' },
  })
  const courtB = await prisma.court.upsert({
    where: { code: 'MAGISTRATE_TLV' },
    update: {},
    create: { name: 'בית משפט שלום – תל אביב', code: 'MAGISTRATE_TLV' },
  })

  // Shift capacity rules — deleteMany + createMany to avoid Postgres NULL unique issue.
  // PostgreSQL treats NULL != NULL in UNIQUE indexes, so upsert on (courtId, shiftType, NULL)
  // would insert duplicates on second seed run. Wipe + recreate is safe for seeding.
  await prisma.shiftCapacityRule.deleteMany({ where: { courtId: courtA.id } })
  await prisma.shiftCapacityRule.createMany({
    data: [
      { courtId: courtA.id, shiftType: ShiftType.MORNING, dayOfWeek: null, minStaff: 3, maxStaff: 5 },
      { courtId: courtA.id, shiftType: ShiftType.EVENING, dayOfWeek: null, minStaff: 2, maxStaff: 3 },
      { courtId: courtA.id, shiftType: ShiftType.NIGHT,   dayOfWeek: null, minStaff: 1, maxStaff: 1 },
    ],
  })

  await prisma.shiftCapacityRule.deleteMany({ where: { courtId: courtB.id } })
  await prisma.shiftCapacityRule.createMany({
    data: [
      { courtId: courtB.id, shiftType: ShiftType.MORNING, dayOfWeek: null, minStaff: 2, maxStaff: 3 },
      { courtId: courtB.id, shiftType: ShiftType.EVENING, dayOfWeek: null, minStaff: 1, maxStaff: 2 },
    ],
  })

  // Manager
  const managerHash = await bcrypt.hash('manager123', 12)
  await prisma.user.upsert({
    where: { email: 'manager@court.gov.il' },
    update: {},
    create: {
      email: 'manager@court.gov.il',
      passwordHash: managerHash,
      name: 'מנהל מערכת',
      role: Role.MANAGER,
    },
  })

  // Guards (primary court: courtA)
  const guardData = [
    { email: 'cohen@court.gov.il',   name: 'יובל כהן' },
    { email: 'levi@court.gov.il',    name: 'מיכל לוי' },
    { email: 'abed@court.gov.il',    name: 'ראמי עבד' },
    { email: 'shamir@court.gov.il',  name: 'עמית שמיר' },
    { email: 'nagar@court.gov.il',   name: 'דנה נגר' },
    { email: 'peretz@court.gov.il',  name: 'אלי פרץ' },
    { email: 'chaim@court.gov.il',   name: 'בן חיים' },
  ]
  const guardHash = await bcrypt.hash('guard123', 12)

  for (const g of guardData) {
    const guard = await prisma.user.upsert({
      where: { email: g.email },
      update: {},
      create: {
        email: g.email,
        passwordHash: guardHash,
        name: g.name,
        role: Role.GUARD,
        primaryCourtId: courtA.id,
      },
    })
    // Court eligibility
    await prisma.courtEligibility.upsert({
      where: { userId_courtId: { userId: guard.id, courtId: courtA.id } },
      update: {},
      create: { userId: guard.id, courtId: courtA.id },
    })
  }

  console.log('Seed complete.')
  console.log('Manager login: manager@court.gov.il / manager123')
  console.log('Guard login:   cohen@court.gov.il / guard123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
