import { DayCategory, ShiftType } from '@/generated/prisma/client';

/** Real day kinds (grid, DB). For selects that also need “all days”, use `DAY_ORDER`. */
const DAY_CATEGORIES: DayCategory[] = ['WEEKDAY', 'FRIDAY', 'SATURDAY', 'HOLIDAY'];

const DAY_ORDER: (DayCategory | 'ALL')[] = [...DAY_CATEGORIES, 'ALL'];

const DAY_META: Record<DayCategory, { label: string }> = {
  WEEKDAY: { label: 'שבוע' },
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

export { DAY_CATEGORIES, DAY_ORDER, DAY_META, SHIFT_ORDER, SHIFT_LABELS };
