import type { ShiftType } from '@/generated/prisma/client';

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

/** Combine a UTC date with facility-local hours (Asia/Jerusalem, UTC+3). */
export function shiftBounds(date: Date, startTime: string, endTime: string) {
  const day = date.toISOString().slice(0, 10);
  const startsAt = new Date(`${day}T${startTime}:00+03:00`);
  const endsAt = new Date(`${day}T${endTime}:00+03:00`);
  if (endsAt <= startsAt) endsAt.setUTCDate(endsAt.getUTCDate() + 1);
  return { startsAt, endsAt };
}

export function defaultShiftTimes(shiftType: ShiftType) {
  return DEFAULT_SHIFT_TIMES.find((shift) => shift.shiftType === shiftType) ?? DEFAULT_SHIFT_TIMES[0];
}
