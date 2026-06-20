import { prisma } from '@/lib/db/client';
import { ScheduleStatus } from '@/generated/prisma/client';
import type {
  EngineAssignment,
  EngineCapacity,
  EngineEmployee,
  EngineInput,
  ShiftType,
} from '@/features/scheduling-engine/types';
import { getLatestDraftVersionId, getPublishedActiveVersionId } from '@/features/schedules/versions/queries';
import { toDateOnly } from '../utils';

type AutoScheduleEngineInputData = Omit<EngineInput, 'scheduleId'> & {
  scheduleId: string | null;
};

export type AutoScheduleInputData =
  | { found: false; message: string }
  | {
      found: true;
      input: AutoScheduleEngineInputData;
      schedule: { id: string; status: ScheduleStatus } | null;
    };

function utcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const next = utcDateOnly(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getPeriodDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  for (let date = utcDateOnly(startDate); date <= utcDateOnly(endDate); date = addUtcDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function createAvailabilityKey(date: Date, shiftType: ShiftType): string {
  return `${toDateOnly(date)}|${shiftType}`;
}

export async function getAutoScheduleInputData(scheduleId: string): Promise<AutoScheduleInputData> {
  if (!scheduleId) return { found: false, message: 'Missing schedule id' };

  const scheduleRow = await prisma.workSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      courtId: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  if (!scheduleRow) return { found: false, message: 'Schedule not found' };
  if (
    scheduleRow.status !== ScheduleStatus.LOCKED &&
    scheduleRow.status !== ScheduleStatus.OPEN &&
    scheduleRow.status !== ScheduleStatus.PUBLISHED
  ) {
    return { found: false, message: 'Period must be open, locked, or published before auto scheduling' };
  }

  const draftVersionId = await getLatestDraftVersionId(scheduleRow.id);
  const publishedVersionId = await getPublishedActiveVersionId(scheduleRow.id);
  const sourceVersionId = draftVersionId ?? publishedVersionId;

  const employeeWhere = { courtId: scheduleRow.courtId, isActive: true };
  const periodDates = getPeriodDates(scheduleRow.startDate, scheduleRow.endDate);

  const [employees, availabilities, capacities, existingAssignments] = await Promise.all([
    prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        courtId: true,
        positionId: true,
        position: { select: { name: true } },
        isActive: true,
      },
      orderBy: [{ positionId: 'asc' }, { id: 'asc' }],
    }),
    prisma.availabilityForm.findMany({
      where: {
        scheduleId: scheduleRow.id,
        employee: employeeWhere,
      },
      select: {
        employeeId: true,
        shifts: {
          where: {
            date: { gte: scheduleRow.startDate, lte: scheduleRow.endDate },
          },
          select: {
            date: true,
            shiftType: true,
          },
        },
      },
    }),
    prisma.shiftCapacity.findMany({
      where: { courtId: scheduleRow.courtId, isActive: true },
      select: {
        positionId: true,
        position: { select: { name: true, code: true } },
        shiftType: true,
        dayCategory: true,
        requiredCount: true,
      },
      orderBy: [{ shiftType: 'asc' }, { positionId: 'asc' }, { dayCategory: 'asc' }, { position: { code: 'asc' } }],
    }),
    sourceVersionId
      ? prisma.shiftAssignment.findMany({
          where: {
            scheduleId: scheduleRow.id,
            versionId: sourceVersionId,
          },
          select: {
            employeeId: true,
            courtId: true,
            positionId: true,
            position: { select: { name: true, code: true } },
            date: true,
            shiftType: true,
          },
          orderBy: [{ date: 'asc' }, { shiftType: 'asc' }, { position: { code: 'asc' } }, { id: 'asc' }],
        })
      : Promise.resolve([]),
  ]);

  const availability = new Map<string, Set<string>>();
  for (const row of availabilities) {
    const keys = availability.get(row.employeeId) ?? new Set<string>();
    for (const entry of row.shifts) {
      keys.add(createAvailabilityKey(entry.date, entry.shiftType));
    }
    availability.set(row.employeeId, keys);
  }

  const cellOrder = new Map<string, number>();
  const manualAssignments = existingAssignments.map((a): EngineAssignment => {
    const cellKey = `${toDateOnly(a.date)}|${a.shiftType}|${a.positionId}`;
    const slotIndex = cellOrder.get(cellKey) ?? 0;
    cellOrder.set(cellKey, slotIndex + 1);
    return {
      employeeId: a.employeeId,
      courtId: a.courtId,
      positionId: a.positionId,
      positionName: a.position.name,
      date: utcDateOnly(a.date),
      shiftType: a.shiftType,
      slotIndex,
      isManualOverride: true,
    };
  });

  return {
    found: true,
    schedule: { id: scheduleRow.id, status: scheduleRow.status },
    input: {
      period: {
        id: scheduleRow.id,
        courtId: scheduleRow.courtId,
        startDate: utcDateOnly(scheduleRow.startDate),
        endDate: utcDateOnly(scheduleRow.endDate),
      },
      week1Dates: periodDates.slice(0, 7),
      week2Dates: periodDates.slice(7),
      employees: employees.map(
        (e): EngineEmployee => ({
          id: e.id,
          positionId: e.positionId,
          positionName: e.position.name,
          courtId: e.courtId,
          isActive: e.isActive,
        }),
      ),
      availability,
      capacities: capacities.map(
        (c): EngineCapacity => ({
          positionId: c.positionId,
          positionName: c.position.name,
          shiftType: c.shiftType,
          dayCategory: c.dayCategory,
          amount: c.requiredCount,
        }),
      ),
      manualAssignments,
      scheduleId: scheduleRow.id,
    },
  };
}
