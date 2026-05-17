import { prisma } from '@/lib/db/client';
import { PeriodStatus, ScheduleStatus } from '@/generated/prisma/client';

import type {
  EngineAssignment,
  EngineCapacity,
  EngineEmployee,
  EngineInput,
  ShiftType,
} from '@/features/scheduling-engine/types';
import { canEmployeeFillPosition } from '@/features/scheduling-engine/role-eligibility';
import type {
  AssignmentMap,
  FutureScheduleData,
  OverflowCandidateMap,
  ScheduleCapacityRule,
  ScheduleEmployeeOption,
  ScheduleWarningSummary,
} from './types';
import { createAssignmentCellKey, getDayCategoryForDate, toDateOnly } from './utils';

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

export function utcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const next = utcDateOnly(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getPeriodDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  for (let date = utcDateOnly(startDate); date <= utcDateOnly(endDate); date = addUtcDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function addIsoDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return toDateOnly(date);
}
