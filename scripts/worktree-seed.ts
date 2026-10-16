import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { assertManagedDatabase } from './worktree-safety.mjs';

const root = realpathSync(process.cwd());
const state = JSON.parse(readFileSync(join(root, '.worktree-dev/state.json'), 'utf8'));
assertManagedDatabase(state, process.env, root);
if (!process.env.WORKTREE_DEMO_PASSWORD) throw new Error('Run this seed through pnpm worktree:dev.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: state.databaseUrl }) });

async function main() {
  if (await prisma.facility.findUnique({ where: { code: 'WORKTREE_DEMO' } })) return;
  const passwordHash = await bcrypt.hash(process.env.WORKTREE_DEMO_PASSWORD!, 10);
  await prisma.$transaction(async tx => {
    const district = await tx.district.create({ data: { name: 'מחוז הדגמה', code: 'WORKTREE_DEMO' } });
    const facility = await tx.facility.create({ data: {
      name: 'מתקן הדגמה מקומי', code: 'WORKTREE_DEMO', districtId: district.id,
      shifts: { create: [
        { shiftType: 'MORNING', startTime: '07:00', endTime: '15:00' },
        { shiftType: 'EVENING', startTime: '15:00', endTime: '23:00' },
        { shiftType: 'NIGHT', startTime: '23:00', endTime: '07:00', endDayOffset: 1 },
      ] },
    } });
    const roles = await tx.role.findMany({ orderBy: { rank: 'asc' } });
    const positions = new Map<number, string>();
    for (const role of roles) {
      const position = await tx.position.upsert({ where: { baseRoleId: role.id }, update: {}, create: {
        name: role.name, baseRoleId: role.id, displayOrder: role.rank, requiredRank: role.rank,
      } });
      positions.set(role.rank, position.id);
      if (role.rank === 1) continue;
      for (const dayCategory of ['WEEKDAY', 'FRIDAY', 'SATURDAY'] as const) {
        for (const shiftType of ['MORNING', 'EVENING', 'NIGHT'] as const) {
          await tx.staffingRequirement.create({ data: { facilityId: facility.id, positionId: position.id, shiftType, dayCategory, requiredCount: 1 } });
        }
      }
    }
    const roleId = (rank: number) => roles.find(role => role.rank === rank)!.id;
    const manager = await tx.user.create({ data: { email: 'manager@worktree.test', passwordHash, firstName: 'מנהל', lastName: 'הדגמה', displayName: 'מנהל הדגמה', facilityId: facility.id, roleId: roleId(1), canEditSchedule: true } });
    const employees = [];
    for (const [index, rank] of [4, 2, 3, 4, 4, 3].entries()) {
      employees.push(await tx.user.create({ data: { email: index === 0 ? 'employee@worktree.test' : `employee${index + 1}@worktree.test`, passwordHash, firstName: 'עובד', lastName: `הדגמה ${index + 1}`, displayName: `עובד הדגמה ${index + 1}`, facilityId: facility.id, roleId: roleId(rank) } }));
    }
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
    const start = new Date(`${today}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() + (7 - start.getUTCDay() || 7));
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
    const schedule = await tx.schedule.create({ data: { facilityId: facility.id, name: 'סידור הדגמה לבדיקת תיקונים', startDate: start, endDate: end, submissionOpensAt: new Date(Date.now() - 86400000), submissionClosesAt: new Date() } });
    const version = await tx.scheduleVersion.create({ data: { scheduleId: schedule.id, facilityId: facility.id, number: 1 } });
    for (let day = 0; day < 7; day++) {
      const date = new Date(start); date.setUTCDate(start.getUTCDate() + day);
      const startsAt = new Date(date); startsAt.setUTCHours(5);
      const endsAt = new Date(date); endsAt.setUTCHours(13);
      await tx.scheduleSlot.create({ data: { facilityId: facility.id, scheduleId: schedule.id, versionId: version.id, positionId: positions.get(4)!, date, shiftType: 'MORNING', slotNumber: 1, startsAt, endsAt, userId: employees[day % employees.length].id } });
    }
    const requirements = await tx.staffingRequirement.findMany({ where: { facilityId: facility.id }, include: { position: true } });
    await tx.scheduleVersion.update({ where: { id: version.id }, data: { status: 'PUBLISHED', publishedAt: new Date(), capacitySnapshot: requirements.map(r => ({ id: r.id, positionId: r.positionId, displayName: r.position.name, rank: r.position.displayOrder, color: r.position.color, shiftType: r.shiftType, dayCategory: r.dayCategory, amount: r.requiredCount })) } });
    await tx.schedule.update({ where: { id: schedule.id }, data: { status: 'PUBLISHED', publishedAt: new Date(), publishedVersionId: version.id } });
    await tx.scheduleChange.create({ data: { facilityId: facility.id, scheduleId: schedule.id, versionId: version.id, changedById: manager.id, changeType: 'PUBLISH', reason: 'נתוני הדגמה מקומיים בלבד' } });
  }, { timeout: 20000 });
  console.log('Local synthetic demo data is ready.');
}
main().finally(() => prisma.$disconnect());
