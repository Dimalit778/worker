'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { dayLetter } from '../schedule-data';
import type { DayOption } from '../types';

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
    <div className="grid w-full grid-cols-7 gap-1 sm:gap-2 lg:gap-3">
      {days.map((day, index) =>
        day ? (
          <button
            key={day.iso}
            type="button"
            className={cn(
              'flex h-11 min-w-0 flex-col items-center justify-center rounded-md border px-1 text-center text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring sm:h-12 sm:px-2 sm:text-xs lg:h-16 lg:text-sm',
              day.iso === selectedDate
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : day.isToday
                  ? 'border-primary bg-primary/15 text-card-foreground shadow-sm ring-2 ring-primary/30'
                  : 'border-border bg-card text-card-foreground hover:bg-muted',
            )}
            onClick={() => onSelectDate(day.iso)}
            aria-label={`${day.dayName}, ${day.dateLabel}`}
            aria-pressed={day.iso === selectedDate}
            aria-current={day.isToday ? 'date' : undefined}
          >
            <span className="text-sm leading-none sm:text-lg lg:text-2xl">{dayLetter(day.iso)}</span>
            <span className="mt-0.5 font-bold sm:mt-1">{day.dateLabel}</span>
          </button>
        ) : (
          <div
            key={`empty-${index}`}
            className="h-10 min-w-0 rounded-md border border-dashed border-border/60 bg-muted/20 sm:h-12 lg:h-16 lg:w-16"
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
  const index = Math.max(0, weeks.findIndex(week => week.days.some(day => day?.iso === selectedDate)));
  const week = weeks[index];
  if (!week) return null;
  function move(offset: number) {
    const day = weeks[index + offset]?.days.find(day => day !== null);
    if (day) onSelectDate(day.iso);
  }
  return (
    <nav aria-label="בחירת תאריך" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button aria-label="השבוע הקודם" variant="outline" className="min-h-11" disabled={index === 0} onClick={() => move(-1)}>→ הקודם</Button>
        <span className="text-sm" aria-live="polite">שבוע {index + 1} מתוך {weeks.length}</span>
        <Button aria-label="השבוע הבא" variant="outline" className="min-h-11" disabled={index === weeks.length - 1} onClick={() => move(1)}>הבא ←</Button>
      </div>
      <WeekDayStrip days={week.days} selectedDate={selectedDate} onSelectDate={onSelectDate} />
    </nav>
  );
}
