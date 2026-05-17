import { prisma } from '@/lib/db/client';
import { PeriodStatus } from '@/generated/prisma/client';
import type { EngineAssignment, EngineCapacity, EngineEmployee, ShiftType } from '@/features/scheduling-engine/types';
import { AutoScheduleInputData, getPeriodDates, utcDateOnly } from '../queries';
import { toDateOnly } from '../utils';
function createAvailabilityKey(date: Date, shiftType: ShiftType): string {
  return `${toDateOnly(date)}|${shiftType}`;
}

export async function getAutoScheduleInputData(periodId: string): Promise<AutoScheduleInputData> {
  if (!periodId) return { found: false, message: 'Missing period id' };

  const periodRow = await prisma.schedulePeriod.findUnique({
    where: { id: periodId },
    select: {
      id: true,
      courtId: true,
      startDate: true,
      endDate: true,
      status: true,
      schedule: { select: { id: true, status: true } },
    },
  });

  if (!periodRow) return { found: false, message: 'Period not found' };
  if (periodRow.status !== PeriodStatus.LOCKED) {
    return { found: false, message: 'Period must be locked before auto scheduling' };
  }

  const employeeWhere = { courtId: periodRow.courtId, isActive: true };
  const periodDates = getPeriodDates(periodRow.startDate, periodRow.endDate);

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
        periodId: periodRow.id,
        employee: employeeWhere,
      },
      select: {
        employeeId: true,
        slots: {
          where: {
            isAvailable: true,
            date: { gte: periodRow.startDate, lte: periodRow.endDate },
          },
          select: {
            date: true,
            shiftType: true,
          },
        },
      },
    }),
    prisma.staffingRequirement.findMany({
      where: { courtId: periodRow.courtId, isActive: true },
      select: {
        positionId: true,
        position: { select: { name: true, code: true } },
        shiftType: true,
        dayCategory: true,
        requiredCount: true,
      },
      orderBy: [{ shiftType: 'asc' }, { positionId: 'asc' }, { dayCategory: 'asc' }, { position: { code: 'asc' } }],
    }),
    periodRow.schedule
      ? prisma.shiftAssignment.findMany({
          where: {
            scheduleId: periodRow.schedule.id,
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
        })
      : Promise.resolve([]),
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
    schedule: periodRow.schedule,
    input: {
      period: {
        id: periodRow.id,
        courtId: periodRow.courtId,
        startDate: utcDateOnly(periodRow.startDate),
        endDate: utcDateOnly(periodRow.endDate),
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
      scheduleId: periodRow.schedule?.id ?? null,
    },
  };
}
