import { defaultShiftTimes, shiftBounds } from './shift-times';
import type { AssignmentMap } from './types';

export function employeeHomeShifts(assignments: AssignmentMap, employeeId: string, now: Date) {
  const shifts = Object.entries(assignments).flatMap(([key, entries]) => {
    const date = key.slice(0, 10);
    return entries.filter(entry => entry.employeeId === employeeId).map(entry => {
      const hours = entry.customHours ?? defaultShiftTimes(entry.shiftType);
      const startsAt = entry.startsAt ?? shiftBounds(new Date(`${date}T00:00:00Z`), hours.startTime, hours.endTime).startsAt.toISOString();
      return { ...entry, date, startsAt, startTime: hours.startTime, endTime: hours.endTime };
    });
  }).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));

  const next = shifts.find(shift => Date.parse(shift.startsAt) >= now.getTime()) ?? null;
  return { next, remaining: shifts.filter(shift => shift.id !== next?.id) };
}
