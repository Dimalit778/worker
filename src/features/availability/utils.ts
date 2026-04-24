import { ShiftType } from '@/generated/prisma/client';

const SHIFTS: { key: ShiftType; label: string; bg: string; text: string; border: string }[] = [
  { key: 'MORNING', label: 'בוקר', bg: 'bg-amber-400', text: 'text-amber-950', border: 'border-amber-300' },
  { key: 'EVENING', label: 'ערב', bg: 'bg-sky-500', text: 'text-white', border: 'border-sky-300' },
  { key: 'NIGHT', label: 'לילה', bg: 'bg-indigo-700', text: 'text-white', border: 'border-indigo-400' },
];

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

export { SHIFTS, DAY_HE, datesInRange };
