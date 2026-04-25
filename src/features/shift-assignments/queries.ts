import { prisma } from '@/lib/db/client';
import { PeriodStatus, ScheduleStatus } from '@/generated/prisma/client';
import type { DraftScheduleData } from '../court-settings/types';
import type { AssignmentMap, SchedulePageData } from './types';
import { getFullCapacityRules } from '../court-settings/queries';
// = למצוא שיבוץ בהכנה
export async function getDraftScheduleData(courtId: string): Promise<DraftScheduleData> {
  const periodRow = await prisma.schedulePeriod.findFirst({
    where: {
      courtId,
      status: PeriodStatus.LOCKED,
    },
    orderBy: { startDate: 'desc' },
  });

  if (!periodRow) {
    return { found: false };
  }

  const scheduleRow = await prisma.schedule.findFirst({
    where: {
      periodId: periodRow.id,
      status: ScheduleStatus.DRAFT,
    },
  });

  const rawAssignments = scheduleRow
    ? await prisma.shiftAssignment.findMany({
        where: { scheduleId: scheduleRow.id },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          courtShiftRole: {
            select: {
              shiftType: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      })
    : [];

  const assignments: AssignmentMap = {};

  for (const a of rawAssignments) {
    const iso = a.date.toISOString().slice(0, 10);
    const key = `${iso}-${a.courtShiftRole.shiftType}`;

    if (!assignments[key]) {
      assignments[key] = [];
    }

    assignments[key].push({
      id: a.id,
      employeeId: a.employeeId,
      employeeName: `${a.employee.firstName} ${a.employee.lastName}`.trim(),
      courtShiftRoleId: a.courtShiftRoleId,
      roleName: a.courtShiftRole.name,
      roleCode: a.courtShiftRole.code,
      slotIndex: a.slotIndex,
    });
  }

  const guards = await prisma.employee.findMany({
    where: {
      courtId,
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  const capacity = await getFullCapacityRules(courtId);

  return {
    found: true,
    periodId: periodRow.id,
    periodName: periodRow.name,
    startDate: periodRow.startDate.toISOString().slice(0, 10),
    endDate: periodRow.endDate.toISOString().slice(0, 10),
    scheduleId: scheduleRow?.id ?? null,
    scheduleStatus: scheduleRow?.status ?? null,
    assignments,
    guards: guards.map((g) => ({
      id: g.id,
      name: `${g.firstName} ${g.lastName}`.trim(),
      position: g.position,
    })),
    capacity,
    courtId,
  };
}
// = למצוא משמרות
export async function getSchedulePageData(
  courtId: string,
  options: { includeGuards?: boolean } = {},
): Promise<SchedulePageData> {
  const periodRow = await prisma.schedulePeriod.findFirst({
    where: {
      courtId,
      status: PeriodStatus.OPEN_FOR_SUBMISSION,
    },
    orderBy: { startDate: 'desc' },
  });
  console.log('periodRow', JSON.stringify(periodRow, null, 2));
  if (!periodRow) return { found: false };

  const scheduleRow = await prisma.schedule.findUnique({
    where: { periodId: periodRow.id },
  });
  console.log('scheduleRow', JSON.stringify(scheduleRow, null, 2));
  const rawAssignments = scheduleRow
    ? await prisma.shiftAssignment.findMany({
        where: { scheduleId: scheduleRow.id },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          courtShiftRole: {
            select: {
              shiftType: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      })
    : [];

  const assignments: AssignmentMap = {};

  for (const a of rawAssignments) {
    const iso = a.date.toISOString().slice(0, 10);
    const key = `${iso}-${a.courtShiftRole.shiftType}`;

    if (!assignments[key]) {
      assignments[key] = [];
    }

    assignments[key].push({
      id: a.id,
      employeeId: a.employeeId,
      employeeName: `${a.employee.firstName} ${a.employee.lastName}`.trim(),
      courtShiftRoleId: a.courtShiftRoleId,
      roleName: a.courtShiftRole.name,
      roleCode: a.courtShiftRole.code,
      slotIndex: a.slotIndex,
    });
  }

  const rawGuards =
    options.includeGuards && courtId
      ? await prisma.employee.findMany({
          where: { courtId, isActive: true },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
          },
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        })
      : [];

  const guards = rawGuards.map((g) => ({
    id: g.id,
    name: `${g.firstName} ${g.lastName}`.trim(),
    position: g.position,
  }));

  const capacity = await getFullCapacityRules(courtId);

  return {
    found: true,
    periodId: periodRow.id,
    periodName: periodRow.name,
    startDate: periodRow.startDate.toISOString().slice(0, 10),
    endDate: periodRow.endDate.toISOString().slice(0, 10),
    scheduleId: scheduleRow?.id ?? null,
    assignments,
    guards,
    capacity,
    courtId,
  };
}
