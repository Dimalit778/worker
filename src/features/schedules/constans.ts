import { PeriodStatus, ScheduleStatus } from '@/generated/prisma/client';
import { PeriodType } from './types';
const DEFAULT_TZ = 'Asia/Jerusalem';
const TZ = 'Asia/Jerusalem';

const PERIOD_STATUS_HE: Record<PeriodStatus, string> = {
  DRAFT: 'טיוטה',
  OPEN_FOR_SUBMISSION: 'פתוח להגשות',
  LOCKED: 'נעול',
  ARCHIVED: 'בארכיון',
};
const STATUS_BADGE: Record<PeriodStatus, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-600',
  OPEN_FOR_SUBMISSION: 'bg-green-100 text-green-700',
  LOCKED: 'bg-amber-100 text-amber-700',
  ARCHIVED: 'bg-zinc-100 text-zinc-400',
};

const NEXT_STATUS: Partial<Record<PeriodStatus, { status: PeriodStatus; label: string }>> = {
  DRAFT: { status: 'OPEN_FOR_SUBMISSION', label: 'פתח להגשות' },
  OPEN_FOR_SUBMISSION: { status: 'LOCKED', label: 'נעל' },
  LOCKED: { status: 'ARCHIVED', label: 'העבר לארכיון' },
};
// Israeli public holidays (Gregorian dates). Covers 2025–2027.
const IL_HOLIDAYS: Record<string, string> = {
  // 5786 (2025-2026)
  '2025-09-22': 'ר״ה',
  '2025-09-23': 'ר״ה',
  '2025-10-01': 'יוה״כ',
  '2025-10-06': 'סוכות',
  '2025-10-07': 'חוה״מ',
  '2025-10-08': 'חוה״מ',
  '2025-10-09': 'חוה״מ',
  '2025-10-10': 'חוה״מ',
  '2025-10-13': 'שמח״ת',
  '2025-12-25': 'חנוכה',
  '2025-12-26': 'חנוכה',
  '2025-12-27': 'חנוכה',
  '2025-12-28': 'חנוכה',
  '2025-12-29': 'חנוכה',
  '2025-12-30': 'חנוכה',
  '2025-12-31': 'חנוכה',
  '2026-01-01': 'חנוכה',
  '2026-03-03': 'פורים',
  '2026-04-01': 'פסח',
  '2026-04-02': 'פסח',
  '2026-04-03': 'חוה״מ',
  '2026-04-04': 'חוה״מ',
  '2026-04-05': 'חוה״מ',
  '2026-04-06': 'חוה״מ',
  '2026-04-07': 'חוה״מ',
  '2026-04-08': 'פסח',
  '2026-04-22': 'יום הזיכרון',
  '2026-04-23': 'יום העצמאות',
  '2026-05-20': 'שבועות',
  '2026-05-21': 'שבועות',
  '2026-07-22': 'תשעה באב',
  // 5787 (2026-2027)
  '2026-09-11': 'ר״ה',
  '2026-09-12': 'ר״ה',
  '2026-09-20': 'יוה״כ',
  '2026-09-25': 'סוכות',
  '2026-10-02': 'שמח״ת',
  '2026-12-14': 'חנוכה',
  '2026-12-15': 'חנוכה',
  '2026-12-16': 'חנוכה',
  '2026-12-17': 'חנוכה',
  '2026-12-18': 'חנוכה',
  '2026-12-19': 'חנוכה',
  '2026-12-20': 'חנוכה',
  '2026-12-21': 'חנוכה',
  '2027-03-23': 'פורים',
  '2027-04-21': 'פסח',
  '2027-04-22': 'פסח',
  '2027-04-28': 'פסח',
};

const DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAY_NAMES_FULL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// --> draft-actions.tsx
const STATUS_LABELS: Record<ScheduleStatus, string> = {
  DRAFT: 'טיוטה',
  FINALIZED: 'סוכם',
  PUBLISHED: 'פורסם',
};

const STATUS_COLORS: Record<ScheduleStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  FINALIZED: 'bg-blue-100 text-blue-800 border-blue-200',
  PUBLISHED: 'bg-green-100 text-green-800 border-green-200',
};
// --> create-period-form.tsx

const PERIOD_OPTIONS: { value: PeriodType; label: string; days: number; desc: string }[] = [
  { value: 'weekly', label: 'שבועי', days: 7, desc: '7 ימים' },
  { value: 'biweekly', label: 'דו-שבועי', days: 14, desc: '14 ימים' },
];

export {
  DEFAULT_TZ,
  TZ,
  PERIOD_STATUS_HE,
  STATUS_BADGE,
  NEXT_STATUS,
  IL_HOLIDAYS,
  DAY_NAMES,
  DAY_NAMES_FULL,
  STATUS_LABELS,
  STATUS_COLORS,
  PERIOD_OPTIONS,
};
