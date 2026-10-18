'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { DAY_NAMES, DAY_NAMES_FULL } from '../constants';
import { buildMonthGrid, deriveFields } from '../utils';
import { Button } from '@/components/ui/button';

function shiftMonth(year: number, month: number, delta: number): { y: number; m: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

type Props = {
  periodDays: number;
  startDate: string;
  onPickStart: (iso: string) => void;
};

export function PeriodRangePicker({ periodDays, startDate, onPickStart }: Props) {
  const parsedStart = useMemo(() => {
    const [y, m] = startDate.split('-').map(Number);
    return { y: y ?? 2026, m: m ?? 1 };
  }, [startDate]);

  const [viewY, setViewY] = useState(parsedStart.y);
  const [viewM, setViewM] = useState(parsedStart.m);
  const [prevStartDate, setPrevStartDate] = useState(startDate);

  if (startDate !== prevStartDate) {
    setPrevStartDate(startDate);
    setViewY(parsedStart.y);
    setViewM(parsedStart.m);
  }

  const weeks = useMemo(() => buildMonthGrid(viewY, viewM), [viewY, viewM]);
  const rangeEnd = deriveFields(startDate, periodDays).end;

  const monthTitle = new Date(`${viewY}-${String(viewM).padStart(2, '0')}-01T12:00:00Z`).toLocaleDateString(
    'he-IL',
    {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    },
  );

  const ymPrefix = `${viewY}-${String(viewM).padStart(2, '0')}`;

  return (
    <div className="space-y-2 rounded-lg border border-border p-3" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => {
            const { y, m } = shiftMonth(viewY, viewM, -1);
            setViewY(y);
            setViewM(m);
          }}
        >
          חודש קודם
        </Button>
        <span className="min-w-0 truncate text-center text-sm font-medium">{monthTitle}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => {
            const { y, m } = shiftMonth(viewY, viewM, 1);
            setViewY(y);
            setViewM(m);
          }}
        >
          חודש הבא
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        לוחצים על יום לבחירת תאריך התחלה. מסומן טווח של {periodDays} ימים (עד {rangeEnd}).
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center text-xs">
          <thead>
            <tr>
              {DAY_NAMES.map((d, i) => (
                <th
                  key={i}
                  className={cn(
                    'pb-1.5 font-medium text-muted-foreground',
                    i === 6 && 'text-blue-500',
                    i === 5 && 'text-amber-200',
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
                  const inMonth = date.startsWith(ymPrefix);
                  const inRange = date >= startDate && date <= rangeEnd;
                  const isStart = date === startDate;
                  const isEnd = date === rangeEnd;
                  const dayNum = parseInt(date.slice(8), 10);

                  return (
                    <td key={date} className="p-0.5">
                      <button
                        type="button"
                        onClick={() => onPickStart(date)}
                        className={cn(
                          'flex min-h-9 w-full flex-col items-center justify-center rounded-lg px-1 py-1 transition-colors',
                          !inMonth && 'text-muted-foreground/45',
                          inMonth && 'hover:bg-muted/70',
                          inRange && inMonth && 'bg-primary/15',
                          isStart && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                          isEnd && !isStart && 'ring-2 ring-primary/70 ring-offset-1 ring-offset-background',
                        )}
                      >
                        <span className={cn('text-sm font-semibold leading-none', isStart && 'text-primary')}>
                          {dayNum}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
