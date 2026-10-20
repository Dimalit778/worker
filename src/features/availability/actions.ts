'use server';
import { periodScheduleStatus, PeriodScheduleStatus } from '@/features/schedules/period-status';
import { Prisma, type Schedule } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { requireEmployee } from '@/lib/db/auth-helpers';
import { expireFacilityData } from '@/lib/cache/data-cache';
import type { CurrentAvailability, EmployeeAvailabilityForPeriod } from './types';
import {
  deriveAvailabilityStatus,
  parseDraftEntries,
  validateAvailabilityEntries,
  type Preference,
  type PreferenceMap,
} from './utils';

type AvailabilityInput = {
  periodId: string;
  entries: Record<string, Preference | boolean>;
  note?: string | null;
};
type ActionResult = { ok: boolean; error?: string; savedAt?: string };

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function submittedMap(rows: { date: Date; shiftType: string; preference: Preference }[]): PreferenceMap {
  return Object.fromEntries(rows.map((s) => [`${isoDate(s.date)}-${s.shiftType}`, s.preference]));
}

export async function getScheduleData(): Promise<CurrentAvailability> {
  const { facilityId, employeeId } = await requireEmployee();
  const now = new Date();
  const schedule = await prisma.schedule.findFirst({
    where: {
      facilityId,
      status: 'DRAFT',
      submissionOpensAt: { lte: now },
      submissionClosesAt: { gt: now },
    },
    orderBy: { startDate: 'asc' },
  });
  if (!schedule) {
    const next = await prisma.schedule.findFirst({
      where: { facilityId, status: 'DRAFT', submissionOpensAt: { gt: now } },
      orderBy: { submissionOpensAt: 'asc' },
      select: { submissionOpensAt: true },
    });
    return {
      period: null,
      entries: {},
      submittedEntries: {},
      isSubmitted: false,
      note: '',
      submittedNote: '',
      status: 'NOT_SUBMITTED',
      closesAt: null,
      lastSavedAt: null,
      submittedAt: null,
      nextOpeningAt: next?.submissionOpensAt.toISOString() ?? null,
    };
  }
  const form = await prisma.availabilitySubmission.findUnique({
    where: { scheduleId_userId: { scheduleId: schedule.id, userId: employeeId } },
    include: { availabilities: true },
  });
  const draft = parseDraftEntries(form?.draftEntries);
  const submittedEntries = form?.submittedAt ? submittedMap(form.availabilities) : {};
  const submittedNote = form?.submittedAt ? (form.note ?? '') : '';
  const lastSaved = form ? (form.draftSavedAt ?? form.submittedAt ?? form.updatedAt) : null;
  return {
    nextOpeningAt: null,
    period: {
      id: schedule.id,
      name: schedule.name,
      startDate: isoDate(schedule.startDate),
      endDate: isoDate(schedule.endDate),
      status: PeriodScheduleStatus.OPEN,
    },
    entries: draft ?? submittedEntries,
    submittedEntries,
    isSubmitted: form?.submittedAt != null,
    note: draft ? (form?.draftNote ?? '') : submittedNote,
    submittedNote,
    status: deriveAvailabilityStatus(form ? { submittedAt: form.submittedAt, hasDraft: draft != null } : null),
    closesAt: schedule.submissionClosesAt.toISOString(),
    lastSavedAt: lastSaved?.toISOString() ?? null,
    submittedAt: form?.submittedAt?.toISOString() ?? null,
  };
}

/** Runs `fn` for an employee inside the open submission window, under the facility lock. */
async function withOpenWindow(
  periodId: string,
  fn: (tx: Prisma.TransactionClient, ctx: { schedule: Schedule; employeeId: string; facilityId: string; now: Date }) => Promise<void>,
  fallbackError: string,
): Promise<ActionResult> {
  const { facilityId, employeeId } = await requireEmployee();
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Facility" WHERE id=${facilityId} FOR UPDATE`;
        const employee = await tx.user.findFirst({ where: { id: employeeId, facilityId } });
        const schedule = await tx.schedule.findFirst({ where: { id: periodId, facilityId } });
        const now = new Date();
        if (employee && !employee.isActive) throw new Error('החשבון מושבת');
        if (
          !employee ||
          !schedule ||
          schedule.status !== 'DRAFT' ||
          now < schedule.submissionOpensAt ||
          now >= schedule.submissionClosesAt
        )
          throw new Error('חלון ההגשות סגור');
        await fn(tx, { schedule, employeeId, facilityId, now });
        return { ok: true, savedAt: now.toISOString() };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    expireFacilityData(facilityId);
    return result;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : fallbackError };
  }
}

/** Saves edits as a draft only: ShiftAvailability and submittedAt are untouched. */
export async function saveAvailabilityDraft(input: AvailabilityInput): Promise<ActionResult> {
  return withOpenWindow(
    input.periodId,
    async (tx, { schedule, employeeId, facilityId, now }) => {
      const rows = validateAvailabilityEntries(input.entries, isoDate(schedule.startDate), isoDate(schedule.endDate));
      const draftEntries = Object.fromEntries(rows.map((row) => [row.key, row.preference]));
      const draftNote = input.note?.trim() || null;
      await tx.availabilitySubmission.upsert({
        where: { scheduleId_userId: { scheduleId: schedule.id, userId: employeeId } },
        create: { scheduleId: schedule.id, userId: employeeId, facilityId, draftEntries, draftNote, draftSavedAt: now },
        update: { draftEntries, draftNote, draftSavedAt: now },
      });
    },
    'שמירת הטיוטה נכשלה',
  );
}

/** Submits availability: only explicit choices become ShiftAvailability rows; clears any draft. */
export async function submitAvailability(input: AvailabilityInput): Promise<ActionResult> {
  return withOpenWindow(
    input.periodId,
    async (tx, { schedule, employeeId, facilityId, now }) => {
      const rows = validateAvailabilityEntries(input.entries, isoDate(schedule.startDate), isoDate(schedule.endDate));
      const note = input.note?.trim() || null;
      const cleared = { draftEntries: Prisma.DbNull, draftNote: null, draftSavedAt: now };
      const form = await tx.availabilitySubmission.upsert({
        where: { scheduleId_userId: { scheduleId: schedule.id, userId: employeeId } },
        create: { scheduleId: schedule.id, userId: employeeId, facilityId, submittedAt: now, note, ...cleared },
        update: { submittedAt: now, note, ...cleared },
      });
      await tx.shiftAvailability.deleteMany({ where: { submissionId: form.id } });
      if (rows.length)
        await tx.shiftAvailability.createMany({
          data: rows.map((row) => ({
            submissionId: form.id,
            date: new Date(`${row.date}T00:00:00Z`),
            shiftType: row.shiftType,
            preference: row.preference,
          })),
        });
    },
    'שמירת הגשה נכשלה',
  );
}

/** Drops the saved draft, returning to the last submitted state (or to "not submitted"). */
export async function discardAvailabilityDraft(periodId: string): Promise<ActionResult> {
  return withOpenWindow(
    periodId,
    async (tx, { schedule, employeeId }) => {
      await tx.availabilitySubmission.updateMany({
        where: { scheduleId: schedule.id, userId: employeeId },
        data: { draftEntries: Prisma.DbNull, draftNote: null, draftSavedAt: null },
      });
    },
    'ביטול הטיוטה נכשל',
  );
}

export async function getEmployeeAvailability(): Promise<EmployeeAvailabilityForPeriod[]> {
  const { facilityId, employeeId } = await requireEmployee();
  const rows = await prisma.availabilitySubmission.findMany({
    where: { userId: employeeId, schedule: { facilityId } },
    include: { schedule: true, availabilities: true },
    orderBy: { schedule: { startDate: 'desc' } },
  });
  return rows.map((row) => ({
    id: row.schedule.id,
    name: row.schedule.name,
    startDate: isoDate(row.schedule.startDate),
    endDate: isoDate(row.schedule.endDate),
    status: periodScheduleStatus(row.schedule),
    submissionStatus: deriveAvailabilityStatus({
      submittedAt: row.submittedAt,
      hasDraft: parseDraftEntries(row.draftEntries) != null,
    }),
    closesAt: row.schedule.submissionClosesAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    isSubmitted: row.submittedAt != null,
    note: row.submittedAt ? (row.note ?? '') : '',
    // Submitted rows only; drafts are never shown as submitted.
    entries: (row.submittedAt ? row.availabilities : []).map((s) => ({
      date: s.date,
      shiftType: s.shiftType,
      isAvailable: s.preference !== 'UNAVAILABLE',
      preference: s.preference,
    })),
  }));
}
export const fetchMyEmployeeAvailability = getEmployeeAvailability;
