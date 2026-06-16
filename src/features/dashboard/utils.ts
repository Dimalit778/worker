import { DEFAULT_TZ } from '@/features/periods/constants';
import type { PeriodSummary } from '@/features/periods/types';
import { calendarDateISO, daysInCalendarMonth } from '@/features/periods/utils';

export type MonthSelection = {
  year: number;
  month: number;
  param: string;
};

function padMonth(month: number) {
  return String(month).padStart(2, '0');
}

export function currentMonthSelection(instant: Date = new Date()): MonthSelection {
  const iso = calendarDateISO(instant, DEFAULT_TZ);
  const [yearStr, monthStr] = iso.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  return { year, month, param: `${yearStr}-${monthStr}` };
}

export function parseMonthParam(value?: string): MonthSelection {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    return currentMonthSelection();
  }

  const [yearStr, monthStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);

  if (month < 1 || month > 12) {
    return currentMonthSelection();
  }

  return { year, month, param: `${yearStr}-${monthStr}` };
}

export function shiftMonth(year: number, month: number, delta: number): MonthSelection {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  const nextYear = date.getUTCFullYear();
  const nextMonth = date.getUTCMonth() + 1;
  return { year: nextYear, month: nextMonth, param: `${nextYear}-${padMonth(nextMonth)}` };
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('he-IL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function filterSchedulesByMonth(
  schedules: PeriodSummary[],
  year: number,
  month: number,
): PeriodSummary[] {
  const pad = (n: number) => String(n).padStart(2, '0');
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = `${year}-${pad(month)}-${pad(daysInCalendarMonth(year, month))}`;

  return schedules.filter((schedule) => schedule.startDate <= monthEnd && schedule.endDate >= monthStart);
}
