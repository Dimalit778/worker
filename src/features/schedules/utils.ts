import { TZ } from './constans';

/** Calendar date YYYY-MM-DD for `instant` in `timeZone` (e.g. Asia/Jerusalem). */
function calendarDateISO(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);

  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !d) {
    throw new Error('calendarDateISO: missing date parts');
  }
  return `${y}-${m}-${d}`;
}

/** UTC midnight for a civil YYYY-MM-DD (matches PostgreSQL `date` semantics for comparisons). */
function parseISODateToUtcMidnight(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) {
    throw new Error(`parseISODateToUtcMidnight: invalid ISO date "${iso}"`);
  }
  return new Date(Date.UTC(y, m - 1, d));
}

function utcNoonFromCalendarISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) {
    throw new Error(`utcNoonFromCalendarISO: invalid ISO date "${iso}"`);
  }
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function todayUtcDateForTimeZone(timeZone: string, instant: Date = new Date()): Date {
  return parseISODateToUtcMidnight(calendarDateISO(instant, timeZone));
}
//  --> preiod-list page
function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function addDays(isoDate: string, n: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  return (new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildWeeks(startDate: string, endDate: string): string[][] {
  const firstDay = new Date(startDate + 'T00:00:00Z');
  const dayOfWeek = firstDay.getUTCDay(); // 0=Sun … 6=Sat
  const paddedStart = addDays(startDate, -dayOfWeek);

  const lastDay = new Date(endDate + 'T00:00:00Z');
  const lastDayOfWeek = lastDay.getUTCDay();
  const paddedEnd = addDays(endDate, 6 - lastDayOfWeek);

  const total = diffDays(paddedStart, paddedEnd) + 1;
  const dates: string[] = Array.from({ length: total }, (_, i) => addDays(paddedStart, i));

  const weeks: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7));
  }
  return weeks;
}

// --> current-period-panel.tsx
function formatDateLong(d: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'long',
    timeZone: TZ,
  }).format(d);
}

function formatDateTimeLong(d: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: TZ,
  }).format(d);
}
// --> create-period-form.tsx
function upcomingSundayISO(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const day = d.getDay();
  const daysUntilSunday = (7 - day) % 7;
  d.setDate(d.getDate() + daysUntilSunday);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const num = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${num}`;
}

function suggestName(start: string, days: number): string {
  const d = new Date(`${start}T12:00:00Z`);
  const month = d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (days === 7) {
    const weekNum = Math.ceil(d.getUTCDate() / 7);
    return `${month} — שבוע ${weekNum}`;
  }
  return month;
}

function deriveFields(start: string, days: number) {
  const end = addDays(start, days - 1);
  const deadline = addDays(end, -2) + 'T17:00';
  return { end, deadline };
}

export {
  calendarDateISO,
  parseISODateToUtcMidnight,
  utcNoonFromCalendarISO,
  todayUtcDateForTimeZone,
  formatDate,
  addDays,
  diffDays,
  isoToday,
  buildWeeks,
  formatDateLong,
  formatDateTimeLong,
  upcomingSundayISO,
  suggestName,
  deriveFields,
};
