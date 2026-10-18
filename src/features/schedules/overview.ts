import { calendarDateISO } from '@/features/periods/utils';
import { SHIFT_ORDER } from './constants';
import type { CurrentScheduleData } from './types';
import { buildShiftSlots } from './current-schedule/schedule-data';

export function nextEmployeeShift(schedules: (CurrentScheduleData | null | undefined)[], employeeId: string, now = new Date()) {
  const today = calendarDateISO(now, 'Asia/Jerusalem');
  return schedules.flatMap(schedule => Object.entries(schedule?.assignments ?? {}).flatMap(([key, assignments]) =>
    assignments.filter(a => a.employeeId === employeeId).map(assignment => ({ date: key.slice(0, 10), assignment })),
  )).filter(({ date, assignment }) => assignment.startsAt ? new Date(assignment.startsAt).getTime() >= now.getTime() : date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || SHIFT_ORDER.indexOf(a.assignment.shiftType) - SHIFT_ORDER.indexOf(b.assignment.shiftType))[0] ?? null;
}

export function todayShortages(schedule: CurrentScheduleData, now = new Date()) {
  const date = calendarDateISO(now, 'Asia/Jerusalem');
  if (date < schedule.startDate || date > schedule.endDate) return null;
  return SHIFT_ORDER.flatMap(shiftType => {
    const slots = buildShiftSlots({ date, shiftType, assignments: schedule.assignments, capacity: schedule.capacity });
    return slots.filter(slot => !slot.assignment).map(slot => ({ shiftType, positionName: slot.positionName, key: slot.key }));
  });
}
