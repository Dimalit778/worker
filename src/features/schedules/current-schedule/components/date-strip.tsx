'use client';

import { WeekNavigator } from '@/features/schedules/draft-schedule/week-navigator';
import { cn } from '@/lib/utils';
import { dayLetter } from '../schedule-data';
import type { DayOption } from '../types';

function weekRangeLabel(days: (DayOption | null)[]): string {
  const present = days.filter((day): day is DayOption => day !== null);
  if (present.length === 0) return '';
  return `${present[0].dateLabel} - ${present[present.length - 1].dateLabel}`;
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
    <div className="mx-auto grid w-full max-w-2xl grid-cols-7 gap-2 sm:gap-3">
      {days.map((day, index) =>
        day ? (
          <button
            key={day.iso}
            type="button"
            className={cn(
              'flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring sm:h-16 sm:px-2',
              day.iso === selectedDate
                ? 'bg-primary text-primary-foreground shadow-md'
                : day.isToday
                  ? 'bg-primary/15 text-card-foreground ring-2 ring-primary/50'
                  : 'border border-border bg-card text-card-foreground shadow-sm hover:bg-muted',
            )}
            onClick={() => onSelectDate(day.iso)}
            aria-label={`${day.dayName}, ${day.dateLabel}`}
            aria-pressed={day.iso === selectedDate}
            aria-current={day.isToday ? 'date' : undefined}
          >
            <span
              className={cn(
                'text-[11px] leading-none font-medium tracking-wide uppercase sm:text-xs',
                day.iso === selectedDate ? 'text-primary-foreground/85' : 'text-muted-foreground',
              )}
            >
              {dayLetter(day.iso)}
            </span>
            <span className="text-sm leading-none font-semibold tabular-nums sm:text-base">
              {day.dateLabel}
            </span>
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

  return (
    <nav aria-label="בחירת תאריך" className="space-y-2">
      <WeekNavigator
        index={index}
        onChange={selectWeek}
        labels={weeks.map((week) => weekRangeLabel(week.days))}
        prevAriaLabel="שבוע א׳"
        nextAriaLabel="שבוע ב׳"
      />
      <WeekDayStrip days={week.days} selectedDate={selectedDate} onSelectDate={onSelectDate} />
    </nav>
  );
}
