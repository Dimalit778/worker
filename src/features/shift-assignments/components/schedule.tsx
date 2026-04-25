'use client';

import { useState } from 'react';
import { WeekNavigator } from './week-navigator';
import { ShiftSection } from './shift-section';
import { buildWeekDays } from '../utils';
import type { ScheduleProps } from '../types';

export function Schedule({
  periodId,
  startDate,
  scheduleId,
  assignments,
  guards,
  capacity,
  courtId,
  readonly = false,
}: ScheduleProps) {
  const [weekIndex, setWeekIndex] = useState(0);
  const weekDays = buildWeekDays(startDate, weekIndex);

  function weekRangeLabel(idx: number): string {
    const days = buildWeekDays(startDate, idx);
    return `${days[0].label} - ${days[6].label}`;
  }

  return (
    <div className="w-full">
      <WeekNavigator
        weekIndex={weekIndex}
        onWeekChange={setWeekIndex}
        week0Label={`${weekRangeLabel(0)}`}
        week1Label={`${weekRangeLabel(1)}`}
      />

      <ShiftSection
        shiftType="MORNING"
        weekDays={weekDays}
        assignments={assignments}
        guards={guards}
        capacity={capacity}
        scheduleId={scheduleId}
        periodId={periodId}
        courtId={courtId}
        readonly={readonly}
      />
      <ShiftSection
        shiftType="EVENING"
        weekDays={weekDays}
        assignments={assignments}
        guards={guards}
        capacity={capacity}
        scheduleId={scheduleId}
        periodId={periodId}
        courtId={courtId}
        readonly={readonly}
      />
      <ShiftSection
        shiftType="NIGHT"
        weekDays={weekDays}
        assignments={assignments}
        guards={guards}
        capacity={capacity}
        scheduleId={scheduleId}
        periodId={periodId}
        courtId={courtId}
        readonly={readonly}
      />
    </div>
  );
}
