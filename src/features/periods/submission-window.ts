import { addDays, calendarDateISO } from './utils';

const TIME_ZONE = 'Asia/Jerusalem';
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type SubmissionWindowRule = {
  openWeekday: number;
  openTime: string;
  closeWeekday: number;
  closeTime: string;
};

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  let hour = value('hour');
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), hour, value('minute'), value('second'));
  return asUtc - instant.getTime();
}

/** Civil date + clock time in `timeZone`, as a UTC instant. */
export function zonedDateTimeToUtc(isoDate: string, timeHHMM: string, timeZone = TIME_ZONE): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  const match = TIME_PATTERN.exec(timeHHMM);
  if (!year || !month || !day || !match) {
    throw new Error(`zonedDateTimeToUtc: invalid datetime "${isoDate}T${timeHHMM}"`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = timeZoneOffsetMs(new Date(utcGuess), timeZone);
  let utc = utcGuess - offset;
  const offsetAtResult = timeZoneOffsetMs(new Date(utc), timeZone);
  if (offsetAtResult !== offset) {
    utc = utcGuess - offsetAtResult;
  }
  return new Date(utc);
}

export function isValidWeekday(day: number): boolean {
  return Number.isInteger(day) && day >= 0 && day <= 6;
}

export function isValidTime(time: string): boolean {
  return TIME_PATTERN.test(time);
}

function weekMinutes(weekday: number, time: string): number {
  const match = TIME_PATTERN.exec(time);
  if (!match) return Number.NaN;
  return weekday * 24 * 60 + Number(match[1]) * 60 + Number(match[2]);
}

/** Sunday-start week that ends the day before `periodStartISO`. */
export function weekBeforeDate(periodStartISO: string, weekday: number): string {
  if (!isValidWeekday(weekday)) {
    throw new Error(`weekBeforeDate: invalid weekday "${weekday}"`);
  }
  const dayBefore = addDays(periodStartISO, -1);
  const dayBeforeDow = new Date(`${dayBefore}T00:00:00Z`).getUTCDay();
  const weekStart = addDays(dayBefore, -dayBeforeDow);
  return addDays(weekStart, weekday);
}

export function instantForRule(periodStartISO: string, weekday: number, time: string): Date {
  return zonedDateTimeToUtc(weekBeforeDate(periodStartISO, weekday), time);
}

export function periodStartInstant(periodStartISO: string): Date {
  return zonedDateTimeToUtc(periodStartISO, '00:00');
}

export function parseJerusalemLocal(value: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  if (!match || !isValidTime(match[2])) return null;
  try {
    return zonedDateTimeToUtc(match[1], match[2]);
  } catch {
    return null;
  }
}

export function formatJerusalemLocal(instant: Date): string {
  const iso = calendarDateISO(instant, TIME_ZONE);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  const hh = hour === '24' ? '00' : hour;
  return `${iso}T${hh}:${minute}`;
}

export function formatJerusalemDateTime(instant: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(instant);
}

export function jerusalemWeekdayAndTime(instant: Date): { weekday: number; time: string } {
  const iso = calendarDateISO(instant, TIME_ZONE);
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return { weekday, time: formatJerusalemLocal(instant).slice(11, 16) };
}

export function isInWeekBefore(periodStartISO: string, instant: Date): boolean {
  const iso = calendarDateISO(instant, TIME_ZONE);
  const weekStart = weekBeforeDate(periodStartISO, 0);
  const weekEnd = addDays(periodStartISO, -1);
  return iso >= weekStart && iso <= weekEnd;
}

export function ruleOrderError(rule: SubmissionWindowRule): string | null {
  if (!isValidWeekday(rule.openWeekday) || !isValidWeekday(rule.closeWeekday)) return 'יום לא תקין';
  if (!isValidTime(rule.openTime) || !isValidTime(rule.closeTime)) return 'שעה לא תקינה';
  if (weekMinutes(rule.openWeekday, rule.openTime) >= weekMinutes(rule.closeWeekday, rule.closeTime)) {
    return 'מועד הפתיחה חייב להיות לפני מועד הסגירה';
  }
  return null;
}

const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;

export type WindowActions = { open: boolean; remind: boolean };

/** Decides which notifications are due for a schedule at `now`. */
export function dueWindowActions(input: {
  now: Date;
  opensAt: Date;
  closesAt: Date;
  openNotifiedAt: Date | null;
  reminderSentAt: Date | null;
}): WindowActions {
  const { now, opensAt, closesAt } = input;
  const isOpen = opensAt <= now && now < closesAt;
  return {
    open: isOpen && !input.openNotifiedAt,
    remind: isOpen && !input.reminderSentAt && now.getTime() >= closesAt.getTime() - REMINDER_LEAD_MS,
  };
}
