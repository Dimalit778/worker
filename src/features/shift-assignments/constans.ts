import type { Position, ShiftType } from '@/generated/prisma/client';

const MORNING_LABELS: Record<number, string> = {
  0: 'אתמ״ש',
  1: 'בקר',
  2: 'בע״ת',
  3: 'פתיחה',
};

const EVENING_LABELS: Record<number, string> = {
  0: 'אתמ״ש',
  1: 'בקר',
  2: 'פתיחה',
};

const NIGHT_LABELS: Record<number, string> = {
  0: 'בע״ת',
  1: 'פתיחה',
};

const HEB_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] as const;

const POSITION_ORDER = ['SHIFT_MANAGER', 'BAKAR', 'FACILITY_OFFICER', 'GUARD'] as const satisfies readonly Position[];

const POSITION_LABELS: Record<Position, string> = {
  SHIFT_MANAGER: 'אחמ״ש',
  BAKAR: 'בקר',
  FACILITY_OFFICER: 'קצין מתקן',
  GUARD: 'מאבטח',
};
const POSITION_ROW_STYLES: Record<Position, string> = {
  SHIFT_MANAGER: 'bg-blue-50/70',
  BAKAR: 'bg-emerald-50/70',
  FACILITY_OFFICER: 'bg-amber-50/70',
  GUARD: '',
};
const SHIFT_STYLES: Record<ShiftType, { header: string; label: string; emoji: string }> = {
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
export {
  MORNING_LABELS,
  EVENING_LABELS,
  NIGHT_LABELS,
  HEB_LETTERS,
  POSITION_ORDER,
  POSITION_LABELS,
  POSITION_ROW_STYLES,
  SHIFT_STYLES,
};
