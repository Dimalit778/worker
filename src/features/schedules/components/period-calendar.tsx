import { cn } from '@/lib/utils';
import type { PeriodSummary } from '../types';

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

interface PeriodCalendarProps {
  period: PeriodSummary;
}

export function PeriodCalendar({ period }: PeriodCalendarProps) {
  const today = isoToday();
  const totalDays = diffDays(period.startDate, period.endDate) + 1;
  const weeks = buildWeeks(period.startDate, period.endDate);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{period.name}</span>
        <span className="text-xs text-muted-foreground">({totalDays} ימים)</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-center border-collapse text-xs">
          <thead>
            <tr>
              {DAY_NAMES.map((d, i) => (
                <th
                  key={i}
                  className={cn(
                    'pb-1.5 font-medium text-muted-foreground',
                    i === 6 && 'text-blue-500',
                    i === 5 && 'text-amber-600',
                  )}
                  title={DAY_NAMES_FULL[i]}
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((date) => {
                  const inPeriod = date >= period.startDate && date <= period.endDate;
                  const isToday = date === today;
                  const holiday = IL_HOLIDAYS[date];
                  const dayNum = parseInt(date.slice(8), 10);
                  const dayOfWeek = new Date(date + 'T00:00:00Z').getUTCDay();
                  const isSat = dayOfWeek === 6;
                  const isFri = dayOfWeek === 5;

                  return (
                    <td key={date} className={cn('p-0.5', !inPeriod && 'opacity-25 pointer-events-none')}>
                      <div
                        className={cn(
                          'flex flex-col items-center justify-center rounded-lg py-1.5 px-1 min-w-10 gap-0.5',
                          inPeriod && 'hover:bg-muted/50',
                          isToday && 'bg-primary text-primary-foreground hover:bg-primary/90',
                          !isToday && isSat && inPeriod && 'text-blue-600',
                          !isToday && isFri && inPeriod && 'text-amber-600',
                          holiday && !isToday && inPeriod && 'bg-orange-50',
                        )}
                      >
                        <span className={cn('text-sm leading-none font-semibold', isToday && 'font-bold')}>
                          {dayNum}
                        </span>
                        {holiday && (
                          <span
                            className={cn(
                              'text-[9px] leading-none font-medium truncate max-w-full',
                              isToday ? 'text-primary-foreground/80' : 'text-orange-600',
                            )}
                          >
                            {holiday}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-primary inline-block" />
          היום
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-orange-50 border border-orange-200 inline-block" />
          חג
        </span>
        <span className="flex items-center gap-1 text-amber-600">ו׳ = שישי</span>
        <span className="flex items-center gap-1 text-blue-600">ש׳ = שבת</span>
      </div>
    </div>
  );
}
