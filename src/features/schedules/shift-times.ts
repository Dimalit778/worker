import type { ShiftType } from '@/generated/prisma/client';
import { zonedDateTimeToUtc } from '@/features/periods/submission-window';
import { addDays } from '@/features/periods/utils';

/** Default hours ("HH:mm") per shift type. endTime < startTime means the shift ends the next day. */
export const DEFAULT_SHIFT_TIMES: { shiftType: ShiftType; startTime: string; endTime: string }[] = [
  { shiftType: 'MORNING', startTime: '07:00', endTime: '15:00' },
  { shiftType: 'EVENING', startTime: '15:00', endTime: '23:00' },
  { shiftType: 'NIGHT', startTime: '23:00', endTime: '07:00' },
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidShiftTime(value: string) {
  return TIME_PATTERN.test(value);
}

/** Combine a UTC-midnight calendar date with facility-local hours (Asia/Jerusalem, DST-aware). */
export function shiftBounds(date: Date, startTime: string, endTime: string) {
  const day = date.toISOString().slice(0, 10);
  const startsAt = zonedDateTimeToUtc(day, startTime);
  // endTime <= startTime: the shift ends on the next calendar day (local).
  const endDay = endTime <= startTime ? addDays(day, 1) : day;
  const endsAt = zonedDateTimeToUtc(endDay, endTime);
  return { startsAt, endsAt };
}

export function defaultShiftTimes(shiftType: ShiftType) {
  return DEFAULT_SHIFT_TIMES.find((shift) => shift.shiftType === shiftType) ?? DEFAULT_SHIFT_TIMES[0];
}
