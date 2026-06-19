'use client';

import { useMemo, useState } from 'react';
import { Shield } from 'lucide-react';
import { DateStrip } from './date-strip';
import { buildDayOptions, buildPeriodWeekGrids } from './schedule-data';
import { ShiftRoster } from './shift-roster';
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
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
            compact
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
            compact
          />
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 text-foreground">
          <Shield className="size-4" aria-hidden />
          <span className="font-semibold">תצוגת שיבוץ מרוכזת</span>
        </div>
        <p className="mt-1">משמרת עמוסה מקבלת יותר רוחב ומוצגת כ־chips לפי תפקיד, כדי לצמצם גלילה.</p>
      </div>
    </div>
  );
}
