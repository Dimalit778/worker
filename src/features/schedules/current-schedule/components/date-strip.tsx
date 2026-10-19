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
    <div className="grid w-full grid-cols-7 gap-1">
      {days.map((day, index) =>
        day ? (
          <button
            key={day.iso}
            type="button"
            className={cn(
              'flex h-9 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring sm:h-10 sm:px-1',
              day.iso === selectedDate
                ? 'bg-primary text-primary-foreground shadow-sm'
                : day.isToday
                  ? 'bg-primary/12 text-card-foreground ring-1 ring-primary/40'
                  : 'bg-muted/50 text-card-foreground ring-1 ring-foreground/5 hover:bg-muted',
            )}
            onClick={() => onSelectDate(day.iso)}
            aria-label={`${day.dayName}, ${day.dateLabel}`}
            aria-pressed={day.iso === selectedDate}
            aria-current={day.isToday ? 'date' : undefined}
          >
            <span
              className={cn(
                'text-[10px] leading-none font-medium tracking-wide sm:text-xs',
                day.iso === selectedDate ? 'text-primary-foreground/80' : 'text-muted-foreground',
              )}
            >
              {dayLetter(day.iso)}
            </span>
            <span className="text-xs leading-none font-semibold tabular-nums sm:text-sm">
              {day.dateLabel}
            </span>
          </button>
        ) : (
          <div
            key={`empty-${index}`}
            className="h-9 min-w-0 rounded-md bg-muted/20 ring-1 ring-dashed ring-foreground/10 sm:h-10"
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
    <nav aria-label="בחירת תאריך" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Button
          aria-label="השבוע הקודם"
          variant="ghost"
          size="sm"
          disabled={index === 0}
          onClick={() => move(-1)}
        >
          → הקודם
        </Button>
        <span className="text-muted-foreground text-xs font-medium" aria-live="polite">
          שבוע {index + 1} מתוך {weeks.length}
        </span>
        <Button
          aria-label="השבוע הבא"
          variant="ghost"
          size="sm"
          disabled={index === weeks.length - 1}
          onClick={() => move(1)}
        >
          הבא ←
        </Button>
      </div>
      <WeekDayStrip days={week.days} selectedDate={selectedDate} onSelectDate={onSelectDate} />
    </nav>
  );
}
