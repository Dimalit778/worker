'use client';

import { useState } from 'react';
import { WeekNavigator } from './week-navigator';
import { ShiftSection } from './shift-section';
import { buildWeekDays } from '../utils';
import { SHIFT_ORDER } from '../constants';
import type { ScheduleViewProps } from '../types';

export function ScheduleView(props: ScheduleViewProps) {
  const {
    startDate,
    scheduleId,
    assignments,
    employees,
    capacity,
    courtId,
    overflowCandidates,
    readonly,
  } = props;
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

      {SHIFT_ORDER.map((shiftType) => (
        <ShiftSection
          key={shiftType}
          shiftType={shiftType}
          weekDays={weekDays}
          assignments={assignments}
          overflowCandidates={overflowCandidates}
          employees={employees}
          capacity={capacity}
          scheduleId={scheduleId}
          courtId={courtId}
          readonly={readonly}
        />
      ))}
    </div>
  );
}
