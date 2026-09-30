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
import { buildWeekDays } from '../utils';
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
}: WeeklyDraftScheduleViewProps) {
  const [weekIndex, setWeekIndex] = useState(0);
  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState<string | null>(initialHighlightedEmployeeId);
  const weekDays = buildWeekDays(startDate, weekIndex);
  const highlightedAssignmentsCount = useMemo(() => {
    if (!highlightedEmployeeId) return 0;
    return Object.values(assignments)
      .flat()
      .filter((assignment) => assignment.employeeId === highlightedEmployeeId).length;
  }, [assignments, highlightedEmployeeId]);

  function weekRangeLabel(idx: number): string {
    const days = buildWeekDays(startDate, idx);
    return `${days[0].label} - ${days[6].label}`;
  }

  return (
    <div className="w-full" dir="rtl">
      <div className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">סימון משמרות לפי עובד</p>
          <p className="text-xs text-muted-foreground">
            {highlightedEmployeeId
              ? `${highlightedAssignmentsCount} משמרות מסומנות לעובד הנבחר`
              : 'בחרו עובד כדי לצבוע את כל המשמרות שלו'}
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

      <WeekNavigator
        weekIndex={weekIndex}
        onWeekChange={setWeekIndex}
        week0Label={weekRangeLabel(0)}
        week1Label={weekRangeLabel(1)}
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
          facilityId={facilityId}
          readonly={readonly}
          highlightedEmployeeId={highlightedEmployeeId}
        />
      ))}
    </div>
  );
}
