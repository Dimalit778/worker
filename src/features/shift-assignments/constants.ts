import type { DayCategory, ShiftType } from '@/generated/prisma/client';

/** Visual / tab order for shift columns or sections */
export const SHIFT_ORDER = ['MORNING', 'EVENING', 'NIGHT'] as const satisfies readonly ShiftType[];

export const SHIFT_LABELS: Record<ShiftType, string> = {
  MORNING: 'בוקר',
  EVENING: 'ערב',
  NIGHT: 'לילה',
};

export const DAY_ORDER = ['WEEKDAY', 'FRIDAY', 'SATURDAY', 'HOLIDAY'] as const satisfies readonly DayCategory[];

export const DAY_LABELS: Record<DayCategory, string> = {
  WEEKDAY: 'יום חול',
  FRIDAY: 'שישי',
  SATURDAY: 'שבת',
  HOLIDAY: 'חג',
};

/** Row labels for slots within a shift (Hebrew), keyed by slotIndex */
export const MORNING_SLOT_LABELS: Record<number, string> = {
  0: 'אתמ״ש',
  1: 'בקר',
  2: 'בע״ת',
  3: 'פתיחה',
};

export const EVENING_SLOT_LABELS: Record<number, string> = {
  0: 'אתמ״ש',
  1: 'בקר',
  2: 'פתיחה',
};

export const NIGHT_SLOT_LABELS: Record<number, string> = {
  0: 'בע״ת',
  1: 'פתיחה',
};

/** Hebrew weekday letters for column headers (Sun–Sat) */
export const WEEKDAY_HEADER_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] as const;

export const SHIFT_STYLES: Record<ShiftType, { header: string; label: string; emoji: string }> = {
  MORNING: {
    header: 'bg-[#0f4c81]',
    label: 'בוקר',
    emoji: '☀️',
  },
  EVENING: {
    header: 'bg-[#1d4ed8]',
    label: 'ערב',
    emoji: '🌆',
  },
  NIGHT: {
    header: 'bg-[#4c1d95]',
    label: 'לילה',
    emoji: '🌙',
  },
};
