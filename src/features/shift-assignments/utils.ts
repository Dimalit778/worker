import { ShiftType } from '@/generated/prisma/client';
import type { WeekDay } from './types';
const HEB_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']; // index = dayOfWeek (0=Sun…6=Sat)
export function buildWeekDays(startDateISO: string, weekIndex: number): WeekDay[] {
  const [y, m, d] = startDateISO.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d + weekIndex * 7));

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i));
    const iso = date.toISOString().slice(0, 10);
    const dayOfWeek = date.getUTCDay(); // 0=Sun
    const letter = HEB_LETTERS[dayOfWeek];
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    return { iso, dayOfWeek, letter, label: `${dd}/${mm}` };
  });
}
export function assignmentKey(isoDate: string, shiftType: ShiftType): string {
  return `${isoDate}-${shiftType}`;
}
const MORNING_LABELS: Record<number, string> = { 0: 'אתמ״ש', 1: 'בקר', 2: 'בע״ת', 3: 'פתיחה' };
const EVENING_LABELS: Record<number, string> = { 0: 'אתמ״ש', 1: 'בקר', 2: 'פתיחה' };
const NIGHT_LABELS: Record<number, string> = { 0: 'בע״ת', 1: 'פתיחה' };

export function getRowLabel(shiftType: ShiftType, slotIndex: number): string {
  const map = shiftType === 'MORNING' ? MORNING_LABELS : shiftType === 'EVENING' ? EVENING_LABELS : NIGHT_LABELS;
  if (map[slotIndex] !== undefined) return map[slotIndex];
  const keys = Object.keys(map)
    .map(Number)
    .sort((a, b) => a - b);
  return map[keys[keys.length - 1]] ?? '';
}
