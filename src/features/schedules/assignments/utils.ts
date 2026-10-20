import { PeriodScheduleStatus } from '@/features/schedules/period-status';
import { ShiftType } from '@/generated/prisma/client';
import {
  AssignmentCellKey,
  AssignmentMap,
  ScheduleEmployeeOption,
  ScheduleCapacityRule,
  ScheduleWarningSummary,
  CurrentScheduleData,
  OverflowCandidateMap,
} from '../types';
import { toDateOnly } from '../utils';
import { customHoursOf } from '../shift-times';

export function getAssignmentCellKey(params: {
  date: Date;
  shiftType: ShiftType;
  positionId: string;
}): AssignmentCellKey {
  return `${toDateOnly(params.date)}-${params.shiftType}-${params.positionId}`;
}

export function buildAssignmentMap(
  rows: Array<{
    date: Date;
    shiftType: ShiftType;
    positionId: string;
    positionName: string;
    id: string;
    employeeId: string;
    employeeDisplayName: string;
    slotIndex: number;
    isLocked?: boolean;
    startsAt?: Date;
    endsAt?: Date;
  }>,
): AssignmentMap {
  const map: AssignmentMap = {};
  for (const row of rows) {
    const key = getAssignmentCellKey({
      date: row.date,
      shiftType: row.shiftType,
      positionId: row.positionId,
    });
    const list = (map[key] ??= []);
    list.push({
      id: row.id,
      startsAt: row.startsAt?.toISOString(),
      customHours: row.startsAt && row.endsAt ? customHoursOf(row.date, row.shiftType, row.startsAt, row.endsAt) : undefined,
      isLocked: row.isLocked,
      employeeId: row.employeeId,
      employeeDisplayName: row.employeeDisplayName,
      positionId: row.positionId,
      positionName: row.positionName,
      shiftType: row.shiftType,
      slotIndex: row.slotIndex,
    });
  }
  for (const list of Object.values(map)) {
    list.sort((a, b) => a.positionId.localeCompare(b.positionId));
    list.forEach((item, index) => {
      item.slotIndex = index;
    });
  }
  return map;
}
export function toScheduleData(
  scheduleRow: {
    id: string;
    status: PeriodScheduleStatus;
    period: {
      name: string;
      startDate: Date;
      endDate: Date;
    };
  },
  facilityId: string,
  employees: ScheduleEmployeeOption[],
  capacity: ScheduleCapacityRule[],
  assignments: AssignmentMap,
  warnings: ScheduleWarningSummary[],
  overflowCandidates: OverflowCandidateMap,
): CurrentScheduleData {
  return {
    scheduleId: scheduleRow.id,
    scheduleName: scheduleRow.period.name,
    startDate: scheduleRow.period.startDate.toISOString().slice(0, 10),
    endDate: scheduleRow.period.endDate.toISOString().slice(0, 10),
    scheduleStatus: scheduleRow.status,
    facilityId,
    employees,
    capacity,
    assignments,
    warnings,
    overflowCandidates,
  };
}
