import { SHIFT_ORDER, SHIFT_LABELS, SHIFT_TONES } from '@/features/schedules/constants';
import type { ShiftType } from '@/generated/prisma/client';

const SHIFTS = SHIFT_ORDER.map(key => ({ key, label: SHIFT_LABELS[key], ...SHIFT_TONES[key] }));

const DAY_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const datesInRange = (start: string, end: string): string[] => {
  const dates: string[] = [];
  const cur = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
};

export type AvailabilityRecordInput = {
  date: Date | string;
  shiftType: ShiftType;
  isAvailable: boolean;
  preference?: 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE';
};

function availabilityEntriesToRecord(entries: AvailabilityRecordInput[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const e of entries) {
    const iso =
      e.date instanceof Date ? e.date.toISOString().slice(0, 10) : String(e.date).slice(0, 10);
    out[`${iso}-${e.shiftType}`] = e.isAvailable;
  }
  return out;
}

export { SHIFTS, DAY_HE, datesInRange, availabilityEntriesToRecord };

export function availabilityPreferencesToRecord(entries: AvailabilityRecordInput[]): Record<string, 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE'> {
  return Object.fromEntries(entries.map(e => {
    const iso = e.date instanceof Date ? e.date.toISOString().slice(0,10) : String(e.date).slice(0,10);
    return [`${iso}-${e.shiftType}`, e.preference ?? (e.isAvailable ? 'AVAILABLE' : 'UNAVAILABLE')];
  }));
}
export function countAvailableEntries(entries: Record<string, boolean | 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE'>): number {
  return Object.values(entries).filter(v => v === true || v === 'AVAILABLE' || v === 'PREFERRED').length;
}
