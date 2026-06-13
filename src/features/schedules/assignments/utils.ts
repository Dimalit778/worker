import { ScheduleStatus, ShiftType } from '@/generated/prisma/client';
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
      employeeId: row.employeeId,
      employeeDisplayName: row.employeeDisplayName,
      positionId: row.positionId,
      positionName: row.positionName,
      shiftType: row.shiftType,
      slotIndex: row.slotIndex,
    });
  }
  for (const list of Object.values(map)) {
    list.sort((a, b) => a.slotIndex - b.slotIndex);
  }
  return map;
}
export function toScheduleData(
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
): CurrentScheduleData {
  return {
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
