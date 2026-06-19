import { prisma } from '@/lib/db/client';
import {
  AssignmentMap,
  OverflowCandidateMap,
  ScheduleCapacityRule,
  ScheduleEmployeeOption,
  ScheduleWarningSummary,
  CurrentScheduleData,
} from '../types';
import { buildAssignmentMap, toScheduleData } from './utils';
import { ScheduleStatus } from '@/generated/prisma/client';
import { todayUtcDateForTimeZone } from '@/features/periods/utils';
const SCHEDULE_TIME_ZONE = 'Asia/Jerusalem';
// Helper functions
async function getScheduleCapacity(courtId: string): Promise<ScheduleCapacityRule[]> {
  if (!courtId) return [];

  const rows = await prisma.staffingRequirement.findMany({
    where: {
      courtId,
      isActive: true,
      position: { name: { not: 'קצין מתקן' } },
    },
    include: {
      position: { select: { id: true, name: true, code: true, color: true } },
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
    color: r.position.color,
    shiftType: r.shiftType,
    dayCategory: r.dayCategory,
    amount: r.requiredCount,
  }));
}
async function getScheduleEmployees(courtId: string): Promise<ScheduleEmployeeOption[]> {
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
async function getAssignmentMap(scheduleId: string | null | undefined): Promise<AssignmentMap> {
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
// Queries
export async function getActiveSchedule(courtId: string): Promise<CurrentScheduleData | null> {
  const today = todayUtcDateForTimeZone(SCHEDULE_TIME_ZONE);

  await prisma.schedule.updateMany({
    where: {
      status: ScheduleStatus.ACTIVE,
      courtId,
      endDate: { lt: today },
    },
    data: { status: ScheduleStatus.ARCHIVED },
  });

  const scheduleRows = await prisma.schedule.findMany({
    where: {
      status: ScheduleStatus.ACTIVE,
      courtId,
      startDate: { lte: today },
      endDate: { gte: today },
    },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
      _count: { select: { assignments: true } },
    },
    orderBy: { startDate: 'desc' },
  });

  const scheduleRow = scheduleRows.find((row) => row._count.assignments > 0) ?? scheduleRows[0];

  if (!scheduleRow) return null;

  const [assignments, capacity, employees] = await Promise.all([
    getAssignmentMap(scheduleRow.id),
    getScheduleCapacity(courtId),
    getScheduleEmployees(courtId),
  ]);

  return toScheduleData(scheduleRow, courtId, employees, capacity, assignments, [], {});
}

export async function getDraftScheduleData(courtId: string): Promise<CurrentScheduleData | null> {
  const schedule = await prisma.schedule.findFirst({
    where: {
      courtId,
      status: { not: ScheduleStatus.ARCHIVED },
    },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      status: true,
    },
    orderBy: { startDate: 'desc' },
  });
  if (!schedule) return null;

  const [assignments, employees, capacity, warnings, overflowCandidates, submittedSubmissions] = await Promise.all([
    getAssignmentMap(schedule.id),
    getScheduleEmployees(courtId),
    getScheduleCapacity(courtId),
    getScheduleWarnings(schedule.id),
    Promise.resolve({} as OverflowCandidateMap),
    prisma.availabilitySubmission.findMany({
      where: {
        scheduleId: schedule.id,
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

  const base = toScheduleData(schedule, courtId, employees, capacity, assignments, warnings, overflowCandidates);
  if (!base) {
    return null;
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
