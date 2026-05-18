import { prisma } from '@/lib/db/client';
import {
  AssignmentMap,
  FutureScheduleData,
  OverflowCandidateMap,
  ScheduleCapacityRule,
  ScheduleEmployeeOption,
  ScheduleWarningSummary,
} from '../types';
import { buildAssignmentMap, toFutureScheduleData } from './utils';
import { PeriodStatus } from '@/generated/prisma/client';

export async function getScheduleCapacity(courtId: string): Promise<ScheduleCapacityRule[]> {
  if (!courtId) return [];

  const rows = await prisma.staffingRequirement.findMany({
    where: { courtId, isActive: true },
    include: {
      position: { select: { id: true, name: true, code: true } },
    },
    orderBy: [
      { shiftType: 'asc' },
      { position: { code: 'asc' } },
      { position: { id: 'asc' } },
      { dayCategory: 'asc' },
      { id: 'asc' },
    ],
  });

  return rows.map((r) => ({
    id: r.id,
    positionId: r.positionId,
    displayName: r.position.name,
    code: r.position.code,
    shiftType: r.shiftType,
    dayCategory: r.dayCategory,
    amount: r.requiredCount,
  }));
}
export async function getScheduleEmployees(courtId: string): Promise<ScheduleEmployeeOption[]> {
  if (!courtId) return [];

  const employees = await prisma.employee.findMany({
    where: { courtId, isActive: true },
    select: {
      id: true,
      displayName: true,
      position: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ position: { code: 'asc' } }],
  });

  return employees.map((e) => ({
    id: e.id,
    displayName: e.displayName,
    position: {
      id: e.position.id,
      name: e.position.name,
      code: e.position.code,
    },
  }));
}
export async function getAssignmentMap(scheduleId: string | null | undefined): Promise<AssignmentMap> {
  if (!scheduleId) return {};

  const rows = await prisma.shiftAssignment.findMany({
    where: { scheduleId },
    include: {
      employee: { select: { displayName: true } },
      position: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ date: 'asc' }, { shiftType: 'asc' }, { slotIndex: 'asc' }, { position: { code: 'asc' } }],
  });

  return buildAssignmentMap(
    rows.map((a) => ({
      id: a.id,
      date: a.date,
      shiftType: a.shiftType,
      positionId: a.positionId,
      positionName: a.position.name,
      employeeId: a.employeeId,
      employeeDisplayName: a.employee.displayName,
      slotIndex: a.slotIndex,
    })),
  );
}
export async function getCurrentSchedule(
  courtId: string,
  options: { includeEmployees?: boolean } = {},
): Promise<FutureScheduleData> {
  const { includeEmployees = false } = options;

  const periodRow = await prisma.schedulePeriod.findFirst({
    where: {
      courtId,
      status: PeriodStatus.LOCKED,
    },
    orderBy: { startDate: 'desc' },
  });

  if (!periodRow) {
    return { found: false, message: 'אין תקופת תזמון פתוחה להגשת זמינות.' };
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

  return toFutureScheduleData(periodRow, scheduleRow, courtId, employees, capacity, assignments, warnings, {});
}
export async function getFutureScheduleData(courtId: string): Promise<FutureScheduleData> {
  const data = await prisma.schedulePeriod.findFirst({
    where: {
      courtId,
      status: { in: [PeriodStatus.OPEN_FOR_SUBMISSION, PeriodStatus.LOCKED] },
    },
    include: {
      schedule: {
        select: { id: true, status: true },
      },
    },
    orderBy: { startDate: 'desc' },
  });
  if (!data) {
    return { found: false, message: 'לא נמצאה תקופה פתוחה להגשות או נעולה לשיבוץ.' };
  }

  const [assignments, employees, capacity, warnings, overflowCandidates, submittedSubmissions] = await Promise.all([
    getAssignmentMap(data.schedule?.id),
    getScheduleEmployees(courtId),
    getScheduleCapacity(courtId),
    getScheduleWarnings(data.schedule?.id),
    Promise.resolve({} as OverflowCandidateMap),
    prisma.availabilitySubmission.findMany({
      where: {
        periodId: data.id,
        isSubmitted: true,
        employee: { courtId, isActive: true },
      },
      select: { employeeId: true },
    }),
  ]);
  const submittedEmployeeIds = new Set(submittedSubmissions.map((submission) => submission.employeeId));
  const missingEmployees = employees
    .filter((employee) => !submittedEmployeeIds.has(employee.id))
    .map((employee) => ({
      id: employee.id,
      displayName: employee.displayName,
      positionName: employee.position?.name ?? null,
    }));

  const base = toFutureScheduleData(
    data,
    data.schedule,
    courtId,
    employees,
    capacity,
    assignments,
    warnings,
    overflowCandidates,
  );
  if (!base.found) {
    return base;
  }

  return {
    ...base,
    availabilitySubmissionSummary: {
      submittedCount: submittedEmployeeIds.size,
      eligibleEmployeeCount: employees.length,
      missingEmployees,
    },
  };
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
      employee: { select: { displayName: true } },
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
    employeeName: warning.employee?.displayName ?? null,
    positionName: warning.position?.name ?? null,
  }));
}
