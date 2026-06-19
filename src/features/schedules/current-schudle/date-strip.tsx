'use client';

import { cn } from '@/lib/utils';
import { dayLetter } from './schedule-data';
import type { DayOption } from './types';

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
    <div className="grid w-full grid-cols-7 gap-1.5 sm:flex sm:w-max sm:gap-2 lg:gap-3">
      {days.map((day, index) =>
        day ? (
          <button
            key={day.iso}
            type="button"
            className={cn(
              'flex h-10 min-w-0 flex-col items-center justify-center rounded-md border px-1 text-center text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:h-12 sm:w-12 sm:shrink-0 sm:px-2 sm:text-xs lg:h-16 lg:w-16 lg:text-sm',
              day.iso === selectedDate
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : day.isToday
                  ? 'border-primary bg-primary/15 text-card-foreground shadow-sm ring-2 ring-primary/30'
                  : 'border-border bg-card text-card-foreground hover:bg-muted',
            )}
            onClick={() => onSelectDate(day.iso)}
            aria-pressed={day.iso === selectedDate}
            aria-current={day.isToday ? 'date' : undefined}
          >
            <span className="text-sm leading-none sm:text-lg lg:text-2xl">{dayLetter(day.iso)}</span>
            <span className="mt-0.5 font-bold sm:mt-1">{day.dateLabel}</span>
          </button>
        ) : (
          <div
            key={`empty-${index}`}
            className="h-10 min-w-0 rounded-md border border-dashed border-border/60 bg-muted/20 sm:h-12 sm:w-12 sm:shrink-0 lg:h-16 lg:w-16"
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
  return (
    <div
      className={cn(
        'flex w-full gap-4 sm:gap-8',
        weeks.length > 1 ? 'flex-col sm:flex-row sm:justify-between' : 'flex-col sm:flex-row sm:justify-start',
      )}
    >
      {weeks.map((week) => (
        <div
          key={week.weekIndex}
          className="w-full min-w-0 pb-1 sm:scrollbar-hide sm:overflow-x-auto sm:overscroll-x-contain"
        >
          <WeekDayStrip days={week.days} selectedDate={selectedDate} onSelectDate={onSelectDate} />
        </div>
      ))}
    </div>
  );
}
