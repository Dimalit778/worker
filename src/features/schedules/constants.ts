import { PeriodScheduleStatus } from '@/features/schedules/period-status';
import type { ShiftType } from '@/generated/prisma/client';
import type { StaffingDayCategory } from './types';

/** Visual / tab order for shift columns or sections */
export const SHIFT_ORDER = ['MORNING', 'EVENING', 'NIGHT'] as const satisfies readonly ShiftType[];

export const SHIFT_LABELS: Record<ShiftType, string> = {
  MORNING: 'בוקר',
  EVENING: 'ערב',
  NIGHT: 'לילה',
};

export const SHIFT_TONES: Record<ShiftType, { bg: string; text: string; border: string }> = {
  MORNING: { bg: 'bg-shift-morning', text: 'text-white', border: 'border-border/60' },
  EVENING: { bg: 'bg-shift-evening', text: 'text-white', border: 'border-border/60' },
  NIGHT: { bg: 'bg-shift-night', text: 'text-white', border: 'border-border/60' },
};

export const DAY_ORDER = ['WEEKDAY', 'FRIDAY', 'SATURDAY', 'HOLIDAY'] as const satisfies readonly StaffingDayCategory[];

export const DAY_LABELS: Record<StaffingDayCategory, string> = {
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

/** Dense Data Surface: dedicated shift-identity tokens (see DESIGN.md), not the generic chart palette. */
export const SHIFT_STYLES: Record<ShiftType, { header: string; label: string; emoji: string }> = {
  MORNING: {
    header: 'bg-shift-morning',
    label: 'בוקר',
    emoji: '☀️',
  },
  EVENING: {
    header: 'bg-shift-evening',
    label: 'ערב',
    emoji: '🌆',
  },
  NIGHT: {
    header: 'bg-shift-night',
    label: 'לילה',
    emoji: '🌙',
  },
};

export const STATUS_LABELS: Record<PeriodScheduleStatus, string> = {
  DRAFT: 'טיוטה',
  OPEN: 'פתוח להגשות',
  LOCKED: 'נעול',
  PUBLISHED: 'פורסם',
  ARCHIVED: 'בארכיון',
};

export const STATUS_COLORS: Record<PeriodScheduleStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  OPEN: 'bg-green-100 text-green-800 border-green-200',
  LOCKED: 'bg-amber-100 text-amber-800 border-amber-200',
  PUBLISHED: 'bg-blue-100 text-blue-800 border-blue-200',
  ARCHIVED: 'bg-neutral-100 text-neutral-700 border-neutral-200',
};
