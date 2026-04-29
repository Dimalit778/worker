import { prisma } from '@/lib/db/client';
import { PeriodStatus, ScheduleStatus } from '@/generated/prisma/client';

import type {
  AssignmentMap,
  DraftScheduleData,
  DraftScheduleFoundData,
  ScheduleCapacityRule,
  ScheduleEmployeeOption,
} from './types';
import { buildAssignmentMap, formatEmployeeName } from './utils';

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
  const [assignments, employees, capacity] = await Promise.all([
    getAssignmentMap(scheduleRow?.id),
    getScheduleEmployees(courtId),
    getScheduleCapacity(courtId),
  ]);
  console.log('assignments', JSON.stringify(assignments, null, 2));
  console.log('employees', JSON.stringify(employees, null, 2));
  console.log('capacity', JSON.stringify(capacity, null, 2));
  return toFoundDraftPayload(periodRow, scheduleRow, courtId, employees, capacity, assignments);
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

  const [assignments, capacity, employees] = await Promise.all([
    getAssignmentMap(scheduleRow?.id),
    getScheduleCapacity(courtId),
    includeEmployees ? getScheduleEmployees(courtId) : Promise.resolve([] as ScheduleEmployeeOption[]),
  ]);

  return toFoundDraftPayload(periodRow, scheduleRow, courtId, employees, capacity, assignments);
}
