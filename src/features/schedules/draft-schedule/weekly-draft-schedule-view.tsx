'use client';

import { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WeekNavigator } from './week-navigator';
import { ShiftSection } from './shift-section';
import { MobileDayScheduleView } from './mobile-day-schedule-view';
import { buildWeekDays, initialWeekIndexForToday } from '../utils';
import { SHIFT_ORDER } from '../constants';
import type { WeeklyDraftScheduleViewProps } from '../types';

const NO_HIGHLIGHT = '__no_highlight__';

export function WeeklyDraftScheduleView({
  startDate,
  scheduleId,
  assignments,
  employees,
  capacity,
  facilityId,
  overflowCandidates,
  readonly,
  highlightedEmployeeId: initialHighlightedEmployeeId = null,
  showHighlightPicker = true,
}: WeeklyDraftScheduleViewProps) {
  const [weekIndex, setWeekIndex] = useState(() => initialWeekIndexForToday(startDate));
  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState<string | null>(initialHighlightedEmployeeId);
  const weekDays = buildWeekDays(startDate, weekIndex);
  const highlightedEmployeeName = employees.find(employee => employee.id === highlightedEmployeeId)?.displayName;
  const highlightedAssignmentsCount = useMemo(() => {
    if (!showHighlightPicker || !highlightedEmployeeId) return 0;
    return Object.values(assignments)
      .flat()
      .filter((assignment) => assignment.employeeId === highlightedEmployeeId).length;
  }, [assignments, highlightedEmployeeId, showHighlightPicker]);
  const highlightedCountLabel = highlightedAssignmentsCount === 1
    ? 'משבצת אחת מסומנת'
    : `${highlightedAssignmentsCount} משבצות מסומנות`;

  function weekRangeLabel(idx: number): string {
    const days = buildWeekDays(startDate, idx);
    return `${days[0].label} - ${days[6].label}`;
  }

  return (
    <div className="mx-auto w-full max-w-6xl" dir="rtl">
      {showHighlightPicker ? (
        <div className="mb-3 flex flex-col gap-1.5 rounded-[8px] border border-border/60 bg-card px-2.5 py-2 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">הבלטת משמרות של עובד</p>
            <p className="text-xs text-muted-foreground">
              {highlightedEmployeeId
                ? `${highlightedEmployeeName ?? 'העובד הנבחר'} · ${highlightedCountLabel} בתקופה. כל הסידור נשאר מוצג.`
                : 'בחרו עובד כדי להבליט את המשמרות שלו בתוך הסידור המלא'}
            </p>
          </div>
          <Select
            value={highlightedEmployeeId ?? NO_HIGHLIGHT}
            onValueChange={(value) => setHighlightedEmployeeId(value === NO_HIGHLIGHT ? null : value)}
          >
            <SelectTrigger className="w-full bg-background sm:w-64" aria-label="בחירת עובד לסימון משמרות">
              <SelectValue placeholder="בחר עובד" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_HIGHLIGHT}>ללא סימון</SelectItem>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <WeekNavigator
        index={weekIndex}
        onChange={setWeekIndex}
        labels={[weekRangeLabel(0), weekRangeLabel(1)]}
        prevAriaLabel="שבוע א׳"
        nextAriaLabel="שבוע ב׳"
      />

      {/* Desktop/tablet: shift-first dense grid. Below md, a table is unusable at this density. */}
      <div className="hidden md:block">
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
            facilityId={facilityId}
            readonly={readonly}
            highlightedEmployeeId={highlightedEmployeeId}
          />
        ))}
      </div>

      {/* Mobile: Day → Shift → Position stacked rows, same data and mutation logic. */}
      <div className="md:hidden">
        <MobileDayScheduleView
          weekDays={weekDays}
          assignments={assignments}
          overflowCandidates={overflowCandidates}
          employees={employees}
          capacity={capacity}
          scheduleId={scheduleId}
          facilityId={facilityId}
          readonly={readonly}
          highlightedEmployeeId={highlightedEmployeeId}
        />
      </div>
    </div>
  );
}
