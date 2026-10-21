'use client';

import { useMemo, useState } from 'react';
import { DateStrip } from './components/date-strip';
import { buildDayOptions, buildPeriodWeekGrids } from './schedule-data';
import { ShiftRoster } from './components/shift-roster';
import type { CurrentScheduleViewProps } from './types';

export function CurrentScheduleView({
  scheduleId,
  startDate,
  endDate,
  assignments,
  overflowCandidates,
  employees,
  capacity,
  facilityId,
  currentEmployeeId,
  readonly,
}: CurrentScheduleViewProps) {
  const days = useMemo(() => buildDayOptions(startDate, endDate), [startDate, endDate]);
  const dayByIso = useMemo(() => new Map(days.map((day) => [day.iso, day])), [days]);
  const periodWeekGrids = useMemo(
    () => buildPeriodWeekGrids(startDate, endDate, dayByIso),
    [startDate, endDate, dayByIso],
  );
  const initialSelectedDate = days.find((day) => day.isToday)?.iso ?? days[0]?.iso ?? startDate;
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5" dir="rtl">
      <DateStrip weeks={periodWeekGrids} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,3fr)_minmax(0,3fr)]">
        <ShiftRoster
          key={`MORNING-${selectedDate}`}
          shiftType="MORNING"
          date={selectedDate}
          scheduleId={scheduleId}
          facilityId={facilityId}
          assignments={assignments}
          overflowCandidates={overflowCandidates}
          employees={employees}
          capacity={capacity}
          currentEmployeeId={currentEmployeeId}
          readonly={readonly}
        />
        <ShiftRoster
          key={`EVENING-${selectedDate}`}
          shiftType="EVENING"
          date={selectedDate}
          scheduleId={scheduleId}
          facilityId={facilityId}
          assignments={assignments}
          overflowCandidates={overflowCandidates}
          employees={employees}
          capacity={capacity}
          currentEmployeeId={currentEmployeeId}
          readonly={readonly}
        />
        <ShiftRoster
          key={`NIGHT-${selectedDate}`}
          shiftType="NIGHT"
          date={selectedDate}
          scheduleId={scheduleId}
          facilityId={facilityId}
          assignments={assignments}
          overflowCandidates={overflowCandidates}
          employees={employees}
          capacity={capacity}
          currentEmployeeId={currentEmployeeId}
          readonly={readonly}
        />
      </div>
    </div>
  );
}
