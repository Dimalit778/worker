'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { AssignmentMap, OverflowCandidateMap, ScheduleCapacityRule, ScheduleEmployeeOption, WeekDay } from '../types';
import { SHIFT_ORDER } from '../constants';
import { ShiftSection } from './shift-section';

type Props = {
  weekDays: WeekDay[];
  assignments: AssignmentMap;
  overflowCandidates?: OverflowCandidateMap;
  employees: ScheduleEmployeeOption[];
  capacity: ScheduleCapacityRule[];
  scheduleId: string;
  facilityId: string;
  readonly?: boolean;
  highlightedEmployeeId?: string | null;
};

/**
 * Mobile variant: a day picker plus the same shift tables as desktop, narrowed to the selected day.
 */
export function MobileDayScheduleView(props: Props) {
  const { weekDays, ...sectionProps } = props;
  const sortedDays = [...weekDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const todayIso = new Date().toISOString().slice(0, 10);
  const selectedDay =
    sortedDays.find((day) => day.iso === selectedIso) ?? sortedDays.find((day) => day.iso === todayIso) ?? sortedDays[0];

  if (!selectedDay) return null;

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <nav aria-label="בחירת יום" className="grid grid-cols-7 gap-1.5">
        {sortedDays.map((day) => {
          const active = day.iso === selectedDay.iso;
          return (
            <button
              key={day.iso}
              type="button"
              className={cn(
                'flex h-12 min-w-0 flex-col items-center justify-center rounded-lg border px-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring',
                active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card text-card-foreground hover:bg-muted',
              )}
              aria-pressed={active}
              aria-label={`${day.letter} ${day.label}`}
              onClick={() => setSelectedIso(day.iso)}
            >
              <span className="text-[11px] leading-none opacity-80">{day.letter}</span>
              <span className="mt-1 text-xs leading-none font-semibold tabular-nums">{day.label.split('/')[0]}</span>
            </button>
          );
        })}
      </nav>
      {SHIFT_ORDER.map((shiftType) => (
        <ShiftSection key={shiftType} shiftType={shiftType} weekDays={[selectedDay]} {...sectionProps} />
      ))}
    </div>
  );
}
