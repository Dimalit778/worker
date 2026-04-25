import { DayCategory, Position, ShiftType } from '@/generated/prisma/client';

const DAY_ORDER: DayCategory[] = ['WEEKDAY', 'FRIDAY', 'SATURDAY', 'HOLIDAY'];

const DAY_META: Record<DayCategory, { label: string }> = {
  WEEKDAY: { label: 'ברירת מחדל (ימים א׳–ה׳)' },
  FRIDAY: { label: 'יום שישי' },
  SATURDAY: { label: 'שבת' },
  HOLIDAY: { label: 'חג' },
};

const SHIFT_ORDER: ShiftType[] = ['MORNING', 'EVENING', 'NIGHT'];

const SHIFT_LABELS: Record<ShiftType, string> = {
  MORNING: 'בוקר',
  EVENING: 'ערב',
  NIGHT: 'לילה',
};

const POSITIONS: { key: Position; label: string }[] = [
  { key: 'SHIFT_MANAGER', label: 'אחמ״ש' },
  { key: 'BAKAR', label: 'בקר' },
  { key: 'GUARD', label: 'מאבטח' },
];

export { DAY_ORDER, DAY_META, SHIFT_ORDER, SHIFT_LABELS, POSITIONS };
