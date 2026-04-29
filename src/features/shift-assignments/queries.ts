import { prisma } from '@/lib/db/client';
import { PeriodStatus, ScheduleStatus } from '@/generated/prisma/client';

import type {
  EngineAssignment,
  EngineCapacity,
  EngineEmployee,
  EngineInput,
  ShiftType,
} from '@/features/scheduling-engine/types';
import type {
  AssignmentMap,
  DraftScheduleData,
  DraftScheduleFoundData,
  OverflowCandidateMap,
  ScheduleCapacityRule,
  ScheduleEmployeeOption,
  ScheduleWarningSummary,
} from './types';
import { buildAssignmentMap, createAssignmentCellKey, formatEmployeeName, toDateOnly } from './utils';

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
  return `${utcDateOnly(date).toISOString().slice(0, 10)}|${shiftType}`;
}

export async function getLockedPeriod(courtId: string) {
  return prisma.schedulePeriod.findFirst({
    where: {
      courtId,
      status: PeriodStatus.LOCKED,
    },
    orderBy: { startDate: 'desc' },
  });
}

export async function getDraftSchedule(periodId: string) {
  return prisma.schedule.findFirst({
    where: {
      periodId,
      status: ScheduleStatus.DRAFT,
    },
    select: {
      id: true,
      status: true,
    },
  });
}

export async function getScheduleCapacity(courtId: string): Promise<ScheduleCapacityRule[]> {
  if (!courtId) return [];

  const rows = await prisma.shiftCapacity.findMany({
    where: { courtId, isActive: true },
    include: {
      position: { select: { id: true, name: true, displayOrder: true } },
    },
    orderBy: [
      { shiftType: 'asc' },
      { position: { displayOrder: 'asc' } },
      { position: { id: 'asc' } },
      { dayCategory: 'asc' },
      { displayOrder: 'asc' },
      { id: 'asc' },
    ],
  });

  return rows.map((r) => ({
    id: r.id,
    positionId: r.positionId,
    positionName: r.position.name,
    positionDisplayOrder: r.position.displayOrder,
    shiftType: r.shiftType,
    dayCategory: r.dayCategory,
    amount: r.amount,
    displayOrder: r.displayOrder,
  }));
}

export async function getScheduleEmployees(courtId: string): Promise<ScheduleEmployeeOption[]> {
  if (!courtId) return [];

  const employees = await prisma.employee.findMany({
    where: { courtId, isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: { select: { id: true, name: true } },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  return employees.map((e) => ({
    id: e.id,
    name: formatEmployeeName(e),
    position: e.position,
  }));
}

export async function getAssignmentMap(scheduleId: string | null | undefined): Promise<AssignmentMap> {
  if (!scheduleId) return {};

  const rows = await prisma.shiftAssignment.findMany({
    where: { scheduleId },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      position: { select: { id: true, name: true } },
    },
    orderBy: [{ date: 'asc' }, { shiftType: 'asc' }, { slotIndex: 'asc' }],
  });

  return buildAssignmentMap(
    rows.map((a) => ({
      id: a.id,
      date: a.date,
      shiftType: a.shiftType,
      positionId: a.positionId,
      positionName: a.position.name,
      employeeId: a.employeeId,
      employeeName: formatEmployeeName(a.employee),
      slotIndex: a.slotIndex,
    })),
  );
}

export async function getScheduleWarnings(scheduleId: string | null | undefined): Promise<ScheduleWarningSummary[]> {
  if (!scheduleId) return [];

  const rows = await prisma.scheduleWarning.findMany({
    where: { scheduleId },
    select: {
      id: true,
      type: true,
      severity: true,
      message: true,
      date: true,
      shiftType: true,
      employee: { select: { firstName: true, lastName: true } },
      position: { select: { name: true } },
    },
    orderBy: [{ severity: 'asc' }, { date: 'asc' }, { shiftType: 'asc' }, { id: 'asc' }],
  });

  return rows.map((warning) => ({
    id: warning.id,
    type: warning.type,
    severity: warning.severity,
    message: warning.message,
    date: warning.date?.toISOString().slice(0, 10) ?? null,
    shiftType: warning.shiftType,
    employeeName: warning.employee ? formatEmployeeName(warning.employee) : null,
    positionName: warning.position?.name ?? null,
  }));
}

export async function getOverflowCandidatesForSchedule(params: {
  periodId: string;
  scheduleId: string | null | undefined;
  courtId: string;
  startDate: Date;
  endDate: Date;
}): Promise<OverflowCandidateMap> {
  if (!params.scheduleId) return {};

  const [availabilities, assignments] = await Promise.all([
    prisma.availability.findMany({
      where: {
        periodId: params.periodId,
        isSubmitted: true,
        employee: {
          courtId: params.courtId,
          isActive: true,
        },
      },
      select: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            positionId: true,
          },
        },
        entries: {
          where: {
            isAvailable: true,
            date: { gte: params.startDate, lte: params.endDate },
          },
          select: {
            date: true,
            shiftType: true,
          },
        },
      },
    }),
    prisma.shiftAssignment.findMany({
      where: { scheduleId: params.scheduleId },
      select: {
        employeeId: true,
        date: true,
        shiftType: true,
        positionId: true,
        slotIndex: true,
      },
    }),
  ]);

  const assignedByDateShift = new Map<string, Set<string>>();
  const assignedBySlot = new Map<string, Set<string>>();
  for (const assignment of assignments) {
    const date = toDateOnly(assignment.date);
    const dateShiftKey = `${date}|${assignment.shiftType}`;
    const cellKey = createAssignmentCellKey({
      date,
      shiftType: assignment.shiftType,
      positionId: assignment.positionId,
    });
    const slotKey = `${cellKey}-${assignment.slotIndex}`;

    const dateShiftAssigned = assignedByDateShift.get(dateShiftKey) ?? new Set<string>();
    dateShiftAssigned.add(assignment.employeeId);
    assignedByDateShift.set(dateShiftKey, dateShiftAssigned);

    const slotAssigned = assignedBySlot.get(slotKey) ?? new Set<string>();
    slotAssigned.add(assignment.employeeId);
    assignedBySlot.set(slotKey, slotAssigned);
  }

  const candidatesByCell = new Map<string, { employeeId: string; employeeName: string }[]>();
  for (const availability of availabilities) {
    const employee = availability.employee;
    for (const entry of availability.entries) {
      const date = toDateOnly(entry.date);
      const dateShiftKey = `${date}|${entry.shiftType}`;
      if (assignedByDateShift.get(dateShiftKey)?.has(employee.id)) continue;

      const cellKey = createAssignmentCellKey({
        date,
        shiftType: entry.shiftType,
        positionId: employee.positionId,
      });
      const candidates = candidatesByCell.get(cellKey) ?? [];
      candidates.push({
        employeeId: employee.id,
        employeeName: formatEmployeeName(employee),
      });
      candidatesByCell.set(cellKey, candidates);
    }
  }

  const result: OverflowCandidateMap = {};
  for (const assignment of assignments) {
    const date = toDateOnly(assignment.date);
    const cellKey = createAssignmentCellKey({
      date,
      shiftType: assignment.shiftType,
      positionId: assignment.positionId,
    });
    const slotKey = `${cellKey}-${assignment.slotIndex}` as keyof OverflowCandidateMap;
    const assignedInSlot = assignedBySlot.get(slotKey) ?? new Set<string>();
    const candidates = (candidatesByCell.get(cellKey) ?? []).filter(
      (candidate) => !assignedInSlot.has(candidate.employeeId),
    );
    if (candidates.length > 0) {
      result[slotKey] = candidates.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'he'));
    }
  }

  return result;
}

function toFoundDraftPayload(
  periodRow: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
  },
  scheduleRow: { id: string; status: ScheduleStatus } | null,
  courtId: string,
  employees: ScheduleEmployeeOption[],
  capacity: ScheduleCapacityRule[],
  assignments: AssignmentMap,
  warnings: ScheduleWarningSummary[],
  overflowCandidates: OverflowCandidateMap,
): DraftScheduleFoundData {
  return {
    found: true,
    periodId: periodRow.id,
    periodName: periodRow.name,
    startDate: periodRow.startDate.toISOString().slice(0, 10),
    endDate: periodRow.endDate.toISOString().slice(0, 10),
    scheduleId: scheduleRow?.id ?? null,
    scheduleStatus: scheduleRow?.status ?? null,
    courtId,
    employees,
    capacity,
    assignments,
    warnings,
    overflowCandidates,
  };
}

/** Locked submission period + draft schedule (manager “שיבוץ בהכנה”). */
export async function getDraftScheduleData(courtId: string): Promise<DraftScheduleData> {
  const periodRow = await getLockedPeriod(courtId);
  if (!periodRow) {
    return { found: false, message: 'No period found' };
  }
  console.log('periodRow', JSON.stringify(periodRow, null, 2));
  const scheduleRow = await getDraftSchedule(periodRow.id);
  console.log('scheduleRow', JSON.stringify(scheduleRow, null, 2));
  const [assignments, employees, capacity, warnings, overflowCandidates] = await Promise.all([
    getAssignmentMap(scheduleRow?.id),
    getScheduleEmployees(courtId),
    getScheduleCapacity(courtId),
    getScheduleWarnings(scheduleRow?.id),
    getOverflowCandidatesForSchedule({
      periodId: periodRow.id,
      scheduleId: scheduleRow?.id,
      courtId,
      startDate: periodRow.startDate,
      endDate: periodRow.endDate,
    }),
  ]);

  return toFoundDraftPayload(
    periodRow,
    scheduleRow,
    courtId,
    employees,
    capacity,
    assignments,
    warnings,
    overflowCandidates,
  );
}

/**
 * Open submission period + its schedule (published manager view / employee view).
 * Same payload shape as `getDraftScheduleData` for a single schedule UI.
 */
export async function getSchedulePageData(
  courtId: string,
  options: { includeEmployees?: boolean } = {},
): Promise<DraftScheduleData> {
  const { includeEmployees = false } = options;

  const periodRow = await prisma.schedulePeriod.findFirst({
    where: {
      courtId,
      status: PeriodStatus.OPEN_FOR_SUBMISSION,
    },
    orderBy: { startDate: 'desc' },
  });

  if (!periodRow) {
    return { found: false, message: 'No active period' };
  }

  const scheduleRow = await prisma.schedule.findUnique({
    where: { periodId: periodRow.id },
    select: { id: true, status: true },
  });

  const [assignments, capacity, employees, warnings] = await Promise.all([
    getAssignmentMap(scheduleRow?.id),
    getScheduleCapacity(courtId),
    includeEmployees ? getScheduleEmployees(courtId) : Promise.resolve([] as ScheduleEmployeeOption[]),
    getScheduleWarnings(scheduleRow?.id),
  ]);

  return toFoundDraftPayload(periodRow, scheduleRow, courtId, employees, capacity, assignments, warnings, {});
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
        isActive: true,
      },
      orderBy: [{ positionId: 'asc' }, { id: 'asc' }],
    }),
    prisma.availability.findMany({
      where: {
        periodId: periodRow.id,
        employee: employeeWhere,
      },
      select: {
        employeeId: true,
        entries: {
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
    prisma.shiftCapacity.findMany({
      where: { courtId: periodRow.courtId, isActive: true },
      select: {
        positionId: true,
        position: { select: { name: true } },
        shiftType: true,
        dayCategory: true,
        amount: true,
      },
      orderBy: [
        { shiftType: 'asc' },
        { positionId: 'asc' },
        { dayCategory: 'asc' },
        { displayOrder: 'asc' },
        { id: 'asc' },
      ],
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
            position: { select: { name: true } },
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
    for (const entry of row.entries) {
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
          amount: c.amount,
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
