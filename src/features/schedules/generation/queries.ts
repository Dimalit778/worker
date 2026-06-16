import { prisma } from '@/lib/db/client';
import { ScheduleStatus } from '@/generated/prisma/client';
import type {
  EngineAssignment,
  EngineCapacity,
  EngineEmployee,
  EngineInput,
  ShiftType,
} from '@/features/scheduling-engine/types';
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

  const scheduleRow = await prisma.schedule.findUnique({
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
  if (scheduleRow.status !== ScheduleStatus.LOCKED && scheduleRow.status !== ScheduleStatus.OPEN_FOR_SUBMISSION) {
    return { found: false, message: 'Period must be open or locked before auto scheduling' };
  }

  const employeeWhere = { courtId: scheduleRow.courtId, isActive: true };
  const periodDates = getPeriodDates(scheduleRow.startDate, scheduleRow.endDate);

  const [employees, availabilities, capacities, manualAssignments] = await Promise.all([
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
    prisma.availabilitySubmission.findMany({
      where: {
        scheduleId: scheduleRow.id,
        employee: employeeWhere,
      },
      select: {
        employeeId: true,
        slots: {
          where: {
            isAvailable: true,
            date: { gte: scheduleRow.startDate, lte: scheduleRow.endDate },
          },
          select: {
            date: true,
            shiftType: true,
          },
        },
      },
    }),
    prisma.staffingRequirement.findMany({
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
    prisma.shiftAssignment.findMany({
      where: {
        scheduleId: scheduleRow.id,
        isManualOverride: true,
      },
      select: {
        employeeId: true,
        courtId: true,
        positionId: true,
        position: { select: { name: true, code: true } },
        date: true,
        shiftType: true,
        slotIndex: true,
        isManualOverride: true,
      },
      orderBy: [{ date: 'asc' }, { shiftType: 'asc' }, { slotIndex: 'asc' }],
    }),
  ]);

  const availability = new Map<string, Set<string>>();
  for (const row of availabilities) {
    const keys = availability.get(row.employeeId) ?? new Set<string>();
    for (const entry of row.slots) {
      keys.add(createAvailabilityKey(entry.date, entry.shiftType));
    }
    availability.set(row.employeeId, keys);
  }

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
      manualAssignments: manualAssignments.map(
        (a): EngineAssignment => ({
          employeeId: a.employeeId,
          courtId: a.courtId,
          positionId: a.positionId,
          positionName: a.position.name,
          date: utcDateOnly(a.date),
          shiftType: a.shiftType,
          slotIndex: a.slotIndex,
          isManualOverride: a.isManualOverride,
        }),
      ),
      scheduleId: scheduleRow.id,
    },
  };
}
