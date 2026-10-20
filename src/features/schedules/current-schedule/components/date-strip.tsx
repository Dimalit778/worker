'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dayLetter } from '../schedule-data';
import type { DayOption } from '../types';

function isWeekend(iso: string): boolean {
  return new Date(`${iso}T00:00:00.000Z`).getUTCDay() >= 5;
}

function WeekDayStrip({
  days,
  selectedDate,
  onSelectDate,
}: {
  days: (DayOption | null)[];
  selectedDate: string;
  onSelectDate: (iso: string) => void;
}) {
  return (
    <div className="grid min-w-0 flex-1 grid-cols-7 gap-2 sm:gap-3">
      {days.map((day, index) =>
        day ? (
          <button
            key={day.iso}
            type="button"
            className={cn(
              'relative flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring sm:h-16 sm:px-2',
              day.iso === selectedDate
                ? 'bg-primary text-primary-foreground shadow-md'
                : cn(
                    'border border-border text-card-foreground shadow-sm hover:bg-muted',
                    isWeekend(day.iso) ? 'bg-muted/50' : 'bg-card',
                  ),
            )}
            onClick={() => onSelectDate(day.iso)}
            aria-label={`${day.dayName}, ${day.dateLabel}`}
            aria-pressed={day.iso === selectedDate}
            aria-current={day.isToday ? 'date' : undefined}
          >
            <span
              className={cn(
                'text-[11px] leading-none font-medium sm:text-xs',
                day.iso === selectedDate ? 'text-primary-foreground/85' : 'text-muted-foreground',
              )}
            >
              {dayLetter(day.iso)}
            </span>
            <span className="text-sm leading-none font-semibold tabular-nums sm:text-base">
              <span className="sm:hidden">{Number(day.dateLabel.split('/')[0])}</span>
              <span className="hidden sm:inline">{day.dateLabel}</span>
            </span>
            {day.isToday ? (
              <span
                className={cn(
                  'absolute bottom-1 size-1.5 rounded-full',
                  day.iso === selectedDate ? 'bg-primary-foreground' : 'bg-primary',
                )}
                aria-hidden
              />
            ) : null}
          </button>
        ) : (
          <div
            key={`empty-${index}`}
            className="h-14 min-w-0 rounded-lg border border-dashed border-border/60 bg-muted/20 sm:h-16"
            aria-hidden
          />
        ),
      )}
    </div>
  );
}

export function DateStrip({
  weeks,
  selectedDate,
  onSelectDate,
}: {
  weeks: { weekIndex: number; days: (DayOption | null)[] }[];
  selectedDate: string;
  onSelectDate: (iso: string) => void;
}) {
  const index = Math.max(0, weeks.findIndex((week) => week.days.some((day) => day?.iso === selectedDate)));
  const week = weeks[index];
  if (!week) return null;

  function selectWeek(weekIndex: number) {
    const day = weeks[weekIndex]?.days.find((entry) => entry !== null);
    if (day) onSelectDate(day.iso);
  }

  const hasWeeks = weeks.length > 1;
  const atStart = index <= 0;
  const atEnd = index >= weeks.length - 1;
  const arrowClass =
    'flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring';

  return (
    <nav aria-label="בחירת תאריך" className="mx-auto flex w-full max-w-2xl items-center gap-2 sm:gap-3">
      {hasWeeks ? (
        <button
          type="button"
          onClick={() => selectWeek(index - 1)}
          disabled={atStart}
          className={cn(arrowClass, atStart ? 'cursor-default opacity-20' : 'hover:bg-muted hover:text-foreground')}
          aria-label="שבוע א׳"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
        </button>
      ) : null}
      <WeekDayStrip days={week.days} selectedDate={selectedDate} onSelectDate={onSelectDate} />
      {hasWeeks ? (
        <button
          type="button"
          onClick={() => selectWeek(index + 1)}
          disabled={atEnd}
          className={cn(arrowClass, atEnd ? 'cursor-default opacity-20' : 'hover:bg-muted hover:text-foreground')}
          aria-label="שבוע ב׳"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
        </button>
      ) : null}
    </nav>
  );
}
