import { cn } from '@/lib/utils';
import type { PeriodSummary } from '../types';
import { IL_HOLIDAYS, DAY_NAMES, DAY_NAMES_FULL } from '../constans';
import { buildWeeks, isoToday, diffDays } from '../utils';

export function PeriodCalendar({ period }: { period: PeriodSummary }) {
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
