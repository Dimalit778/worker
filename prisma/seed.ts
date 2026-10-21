import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient, type ShiftType } from '../src/generated/prisma/client';
import * as employeeGroups from './data';
import { guardPrismaWorktree } from '../scripts/worktree-safety.mjs';
import { generateSchedule } from '../src/features/scheduling-engine/generate-schedule';
import { validateAssignments } from '../src/features/scheduling-engine/validate';
import { buildSlots } from '../src/features/scheduling-engine/slots';
import type { EngineAssignment, EngineInput } from '../src/features/scheduling-engine/types';
import { analyzeSchedule } from '../src/features/schedules/generation/recalculate';
import { DEFAULT_SHIFT_TIMES, shiftBounds } from '../src/features/schedules/shift-times';
import { addDays, parseISODateToUtcMidnight, todayUtcDateForTimeZone } from '../src/features/periods/utils';

const DISTRICTS = [
  { code: 'TEL_AVIV', name: 'מחוז תל אביב', facilities: [
    { code: 'SHOKEN', name: 'שוקן' }, { code: 'BAT_YAM', name: 'בת ים' },
  ] },
];
// Each tuple is [shift manager, controller, guards]. Unspecified roles have zero capacity.
export const DEMO_STAFFING = {
  BAT_YAM: {
    WEEKDAY: { MORNING: [1, 1, 13], EVENING: [1, 1, 4], NIGHT: [1, 0, 2] },
    FRIDAY: { MORNING: [1, 0, 3], EVENING: [0, 0, 2], NIGHT: [0, 0, 3] },
    SATURDAY: { MORNING: [0, 0, 2], EVENING: [0, 0, 2], NIGHT: [0, 0, 3] },
  },
  SHOKEN: {
    WEEKDAY: { MORNING: [1, 0, 8], EVENING: [1, 0, 3], NIGHT: [0, 0, 2] },
    FRIDAY: { MORNING: [1, 0, 3], EVENING: [0, 0, 2], NIGHT: [0, 0, 2] },
    SATURDAY: { MORNING: [0, 0, 2], EVENING: [0, 0, 2], NIGHT: [0, 0, 2] },
  },
} as const;
const ROLES = [
  { code: 'MANAGER', name: 'קצין מתקן', rank: 1 },
  { code: 'SHIFT_MANAGER', name: 'אחמ״ש', rank: 2 },
  { code: 'BAKAR', name: 'בקר', rank: 3 },
  { code: 'GUARD', name: 'מאבטח', rank: 4 },
];
const SHIFT_TYPES: ShiftType[] = ['MORNING', 'EVENING', 'NIGHT'];
const DAY_CATEGORIES = ['WEEKDAY', 'FRIDAY', 'SATURDAY'] as const;

type EmployeeSeed = {
  firstName: string; lastName: string; displayName: string;
  email: string; password: string; facilityCode: string;
  roleCode?: string; positionRank?: number; phone?: string; phoneNumber?: string;
  isManager?: boolean; canEditSchedule?: boolean; isReligious?: boolean;
};

/** Import only employees whose own facilityCode is included in this demo. */
export function prepareEmployees(groups: Record<string, EmployeeSeed[]> = employeeGroups) {
  const usedEmails = new Set<string>();
  return Object.values(groups).flat().filter(employee =>
    DISTRICTS.some(d => d.facilities.some(f => f.code === employee.facilityCode)),
  ).map(employee => {
    const role = ROLES.find(role => employee.roleCode ? role.code === employee.roleCode : role.rank === employee.positionRank);
    const facilityCode = employee.facilityCode;
    if (!role || !DISTRICTS.some(d => d.facilities.some(f => f.code === facilityCode))) {
      throw new Error(`תפקיד או מתקן לא מוכר עבור ${employee.email}`);
    }
    const originalEmail = employee.email.trim().toLowerCase();
    let email = originalEmail;
    let suffix = 1;
    const at = originalEmail.lastIndexOf('@');
    if (at < 1) throw new Error(`אימייל לא תקין: ${originalEmail}`);
    while (usedEmails.has(email)) {
      email = `${originalEmail.slice(0, at)}+${facilityCode.toLowerCase()}${suffix === 1 ? '' : suffix}@${originalEmail.slice(at + 1)}`;
      suffix++;
    }
    usedEmails.add(email);
    return { ...employee, email, originalEmail, facilityCode, roleCode: role.code,
      phoneNumber: (employee.phoneNumber ?? employee.phone)?.trim() ?? null,
      canEditSchedule: employee.canEditSchedule ?? (employee.isManager || role.rank === 1),
    };
  });
}

export function periodDates(start: string, end: string) {
  const startDate = parseISODateToUtcMidnight(start);
  const endDate = parseISODateToUtcMidnight(end);
  const days = (endDate.getTime() - startDate.getTime()) / 86400000 + 1;
  if (days !== 7 && days !== 14) throw new Error('הטווח חייב לכלול 7 או 14 ימים, כולל תאריך הסיום.');
  return Array.from({ length: days }, (_, i) => parseISODateToUtcMidnight(addDays(start, i)));
}

/** Keep weekly minimums first, then at most two extra legal assignments per employee/week. */
export function generateDemoAssignments(input: EngineInput) {
  const staffInput = { ...input, employees: input.employees.filter(employee => employee.rank !== 1) };
  const generated = generateSchedule(staffInput).assignments;
  const assignments: EngineAssignment[] = [];
  for (const employee of staffInput.employees) {
    for (const dates of [input.week1Dates, input.week2Dates]) {
      if (!dates.length) continue;
      const days = new Set(dates.map(date => date.getTime()));
      const candidates = generated.filter(a => a.employeeId === employee.id && days.has(a.date.getTime()));
      const minimums = [
        ...candidates.filter(a => a.shiftType === 'MORNING').slice(0, 2),
        ...candidates.filter(a => a.shiftType === 'EVENING').slice(0, 1),
      ];
      const selected = new Set(minimums);
      assignments.push(...minimums, ...candidates.filter(a => !selected.has(a)).slice(0, 2));
    }
  }
  return { assignments, ...analyzeSchedule(staffInput, assignments) };
}

/** Data only: no schema reset, trigger changes, CASCADE, or migration-history deletion. */
export async function seedDemo(prisma: PrismaClient, start: string, end: string) {
  const dates = periodDates(start, end);
  const employees = prepareEmployees();
  const hashes = new Map<string, string>();
  for (const employee of employees) {
    if (!hashes.has(employee.password)) hashes.set(employee.password, await bcrypt.hash(employee.password, 10));
  }
  return prisma.$transaction(async tx => {
    // All application tables together handles circular published/original-version references.
    // TRUNCATE is transactional and leaves the schema, triggers and _prisma_migrations intact.
    await tx.$executeRaw`TRUNCATE TABLE "Account", "Session", "VerificationToken", "EmployeeRequest",
      "ScheduleChange", "ShiftAvailability", "AvailabilitySubmission", "ScheduleSlot", "ScheduleVersion",
      "Schedule", "StaffingDateOverride", "StaffingRequirement", "FacilityShift", "User", "Position",
      "Role", "Facility", "District", "SystemSetting"`;

    for (const role of ROLES) {
      const saved = await tx.role.create({ data: role });
      await tx.position.create({ data: { name: role.name, baseRoleId: saved.id, requiredRank: role.rank, displayOrder: role.rank } });
    }
    for (const { facilities, ...district } of DISTRICTS) {
      const saved = await tx.district.create({ data: district });
      for (const facility of facilities) {
        await tx.facility.create({ data: { ...facility, districtId: saved.id, shifts: {
          create: DEFAULT_SHIFT_TIMES.map(shift => ({ ...shift, endDayOffset: shift.shiftType === 'NIGHT' ? 1 : 0 })),
        } } });
      }
    }
    const facilities = await tx.facility.findMany();
    const roles = await tx.role.findMany();
    for (const employee of employees) {
      await tx.user.create({ data: {
        firstName: employee.firstName, lastName: employee.lastName, displayName: employee.displayName,
        email: employee.email, phoneNumber: employee.phoneNumber,
        passwordHash: hashes.get(employee.password)!,
        facilityId: facilities.find(f => f.code === employee.facilityCode)!.id,
        roleId: roles.find(r => r.code === employee.roleCode)!.id,
        canEditSchedule: employee.canEditSchedule, isReligious: employee.isReligious ?? false,
      } });
    }
    const positions = await tx.position.findMany({ orderBy: { displayOrder: 'asc' } });
    const now = new Date();
    const submittedAt = new Date(now.getTime() - 120000);
    const summaries = [];
    for (const facility of facilities) {
      const users = await tx.user.findMany({ where: { facilityId: facility.id }, include: { role: true } });
      const staffing = DEMO_STAFFING[facility.code as keyof typeof DEMO_STAFFING];
      for (const position of positions.filter(p => p.requiredRank !== 1)) {
        for (const dayCategory of DAY_CATEGORIES) for (const shiftType of SHIFT_TYPES) {
          const requiredCount = staffing[dayCategory][shiftType][position.requiredRank! - 2];
          await tx.staffingRequirement.create({ data: { facilityId: facility.id, positionId: position.id, shiftType, dayCategory, requiredCount } });
        }
      }
      if (!users.length) continue;
      const schedule = await tx.schedule.create({ data: {
        facilityId: facility.id, name: `שיבוץ דמה ${facility.name} — ${start} עד ${end}`,
        startDate: dates[0], endDate: dates[dates.length - 1],
        submissionOpensAt: new Date(now.getTime() - 86400000),
        submissionClosesAt: new Date(now.getTime() - 60000),
        openNotifiedAt: now, reminderSentAt: now,
      } });
      const availability = new Map<string, Set<string>>();
      for (const user of users) {
        const entries = dates.flatMap(date => SHIFT_TYPES.map(shiftType => ({ date, shiftType, preference: 'AVAILABLE' as const })));
        await tx.availabilitySubmission.create({ data: {
          facilityId: facility.id, scheduleId: schedule.id, userId: user.id, submittedAt,
          availabilities: { create: entries }, note: 'הגשת דמה אוטומטית',
        } });
        availability.set(user.id, new Set(entries.map(e => `${e.date.toISOString().slice(0, 10)}|${e.shiftType}`)));
      }
      const requirements = await tx.staffingRequirement.findMany({ where: { facilityId: facility.id }, include: { position: true } });
      const input: EngineInput = {
        period: { id: schedule.id, facilityId: facility.id, startDate: dates[0], endDate: dates[dates.length - 1] },
        scheduleId: schedule.id, week1Dates: dates.slice(0, 7), week2Dates: dates.slice(7),
        employees: users.map(u => ({ id: u.id, facilityId: facility.id, rank: u.role.rank, isActive: true,
          positionId: positions.find(p => p.baseRoleId === u.roleId)!.id })),
        availability, manualAssignments: [],
        capacities: requirements.map(r => ({ positionId: r.positionId, positionName: r.position.name,
          requiredRank: r.position.requiredRank!, shiftType: r.shiftType, dayCategory: r.dayCategory, amount: r.requiredCount })),
      };
      const result = generateDemoAssignments(input);
      const errors = validateAssignments(input, result.assignments, { allowManualOverrides: false });
      if (errors.length) throw new Error(errors.join('; '));
      const capacitySnapshot = requirements.map(r => ({ id: r.id, positionId: r.positionId,
        displayName: r.position.name, rank: r.position.requiredRank!, color: r.position.color,
        shiftType: r.shiftType, dayCategory: r.dayCategory, amount: r.requiredCount }));
      // Both copies are built as drafts, then frozen; original remains immutable in the app.
      const versions = [];
      for (const number of [0, 1]) {
        const version = await tx.scheduleVersion.create({ data: { scheduleId: schedule.id, facilityId: facility.id, number, capacitySnapshot } });
        const slots: Prisma.ScheduleSlotCreateManyInput[] = [];
        for (const slot of buildSlots(input)) {
          const assigned = result.assignments.filter(a => a.positionId === slot.positionId && a.shiftType === slot.shiftType && a.date.getTime() === slot.date.getTime());
          const hours = DEFAULT_SHIFT_TIMES.find(s => s.shiftType === slot.shiftType)!;
          for (let i = 0; i < slot.requiredAmount; i++) slots.push({
            facilityId: facility.id, scheduleId: schedule.id, versionId: version.id,
            positionId: slot.positionId, date: slot.date, shiftType: slot.shiftType, slotNumber: i + 1,
            ...shiftBounds(slot.date, hours.startTime, hours.endTime), userId: assigned[i]?.employeeId ?? null, source: 'AUTOMATIC',
          });
        }
        await tx.scheduleSlot.createMany({ data: slots });
        await tx.scheduleVersion.update({ where: { id: version.id }, data: { status: 'PUBLISHED', publishedAt: now } });
        versions.push(version);
      }
      await tx.schedule.update({ where: { id: schedule.id }, data: {
        status: 'PUBLISHED', publishedAt: now, originalVersionId: versions[0].id, publishedVersionId: versions[1].id,
      } });
      const actor = users.find(u => u.canEditSchedule) ?? users[0];
      await tx.scheduleChange.create({ data: {
        facilityId: facility.id, scheduleId: schedule.id, versionId: versions[1].id, changedById: actor.id,
        changeType: 'PUBLISH', reason: 'יצירה ושיבוץ אוטומטי של נתוני דמה',
        afterData: { warnings: result.warnings.map(w => w.message) },
      } });
      summaries.push({ facility: facility.name, employees: users.length, assignments: result.assignments.length, warnings: result.warnings.length });
    }
    return { summaries, employees };
  }, { timeout: 120000 });
}

async function main() {
  config({ path: resolve(process.cwd(), '.env.local'), quiet: true });
  config({ path: resolve(process.cwd(), '.env'), quiet: true });
  guardPrismaWorktree(process.cwd(), process.env);
  if (process.env.NODE_ENV === 'production') throw new Error('סיד דמה אינו מיועד לסביבת production.');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const target = new URL(connectionString);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  let start: string;
  let end: string;
  try {
    start = (await prompt.question('תאריך התחלה (YYYY-MM-DD): ')).trim();
    end = (await prompt.question('תאריך סיום, כולל (YYYY-MM-DD): ')).trim();
    periodDates(start, end);
    const today = todayUtcDateForTimeZone('Asia/Jerusalem');
    if (parseISODateToUtcMidnight(start) > today || parseISODateToUtcMidnight(end) < today) {
      throw new Error('הטווח חייב לכלול את היום כדי שהשיבוץ יופיע כשיבוץ נוכחי.');
    }
    const employees = prepareEmployees();
    for (const employee of employees.filter(e => e.email !== e.originalEmail)) {
      console.log(`אימייל דמה ייחודי: ${employee.originalEmail} → ${employee.email} (${employee.facilityCode})`);
    }
    console.log(`מחיקה מלאה של נתוני האפליקציה במסד ${target.hostname}${target.pathname}. היסטוריית שיבוצים ומשתמשים תימחק.`);
    if ((await prompt.question('להמשך הקלד DELETE: ')).trim() !== 'DELETE') {
      console.log('בוטל. לא בוצע שינוי במסד.');
      return;
    }
  } finally { prompt.close(); }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const result = await seedDemo(prisma, start, end);
    console.table(result.summaries);
    console.log('הסיד הושלם. לכל העובדים נוצרו הגשות זמינות; השיבוצים פורסמו עם עותק מקור ושיבוץ נוכחי.');
    console.log('מתקנים ללא עובדים נטענו ללא שיבוץ. אזהרות מציינות חוסרים לפי כוח האדם והאילוצים.');
    console.table(result.employees.filter(e => e.canEditSchedule).map(e => ({ facility: e.facilityCode, email: e.email, password: e.password })));
  } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : 'הסיד נכשל.');
    process.exitCode = 1;
  });
}
