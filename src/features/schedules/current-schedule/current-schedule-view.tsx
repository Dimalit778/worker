'use client';

import { useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import { DateStrip } from './components/date-strip';
import { buildDayOptions, buildPeriodWeekGrids } from './schedule-data';
import { ShiftRoster } from './components/shift-roster';
import type { CurrentScheduleViewProps } from './types';

export function CurrentScheduleView({
  scheduleId,
  startDate,
  endDate,
  scheduleName,
  assignments,
  overflowCandidates,
  employees,
  capacity,
  courtId,
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
  const selectedDay = days.find((day) => day.iso === selectedDate) ?? days[0];

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">{scheduleName}</h1>
        {selectedDay ? (
          <p className="text-sm text-muted-foreground">
            {selectedDay.dayName}, {selectedDay.dateLabel}
          </p>
        ) : null}
      </div>

      <DateStrip weeks={periodWeekGrids} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,3fr)_minmax(0,3fr)]">
        <ShiftRoster
          shiftType="MORNING"
          date={selectedDate}
          scheduleId={scheduleId}
          courtId={courtId}
          assignments={assignments}
          overflowCandidates={overflowCandidates}
          employees={employees}
          capacity={capacity}
          currentEmployeeId={currentEmployeeId}
          readonly={readonly}
        />
        <ShiftRoster
          shiftType="EVENING"
          date={selectedDate}
          scheduleId={scheduleId}
          courtId={courtId}
          assignments={assignments}
          overflowCandidates={overflowCandidates}
          employees={employees}
          capacity={capacity}
          currentEmployeeId={currentEmployeeId}
          readonly={readonly}
        />
        <ShiftRoster
          shiftType="NIGHT"
          date={selectedDate}
          scheduleId={scheduleId}
          courtId={courtId}
          assignments={assignments}
          overflowCandidates={overflowCandidates}
          employees={employees}
          capacity={capacity}
          currentEmployeeId={currentEmployeeId}
          readonly={readonly}
        />
      </div>

      <div className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-foreground">
          <Shield className="size-4" aria-hidden />
          <span className="font-semibold">תצוגת שיבוץ מרוכזת</span>
        </div>
        <p className="mt-1">המשמרות מוצגות לפי בוקר, ערב ולילה. במסכים קטנים הן מוצגות אחת מתחת לשנייה.</p>
      </div>
    </div>
  );
}
