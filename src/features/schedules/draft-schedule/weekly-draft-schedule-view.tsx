'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WeekNavigator } from './week-navigator';
import { EmployeeLoadTile, ScheduleStats } from './schedule-stats';
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
  loadReadiness,
  toolbarStats,
}: WeeklyDraftScheduleViewProps) {
  const [weekIndex, setWeekIndex] = useState(() => initialWeekIndexForToday(startDate));
  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState<string | null>(initialHighlightedEmployeeId);
  const weekDays = buildWeekDays(startDate, weekIndex);

  function weekRangeLabel(idx: number): string {
    const days = buildWeekDays(startDate, idx);
    return `${days[0].label} - ${days[6].label}`;
  }

  return (
    <div className="mx-auto w-full max-w-6xl" dir="rtl">
      <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        {toolbarStats ? (
          <div className="min-w-0 w-full">
            <ScheduleStats
              warnings={toolbarStats.warnings}
              hasSchedule={toolbarStats.hasSchedule}
              submittedCount={toolbarStats.submittedCount}
              eligibleCount={toolbarStats.eligibleCount}
              missingEmployees={toolbarStats.missingEmployees}
              readiness={
                loadReadiness
                  ? { scheduleId, versionId: loadReadiness.versionId, revision: loadReadiness.revision }
                  : undefined
              }
              showLoadTile={false}
              layout="inline"
            />
          </div>
        ) : (
          <div aria-hidden />
        )}
        <WeekNavigator
          index={weekIndex}
          onChange={setWeekIndex}
          labels={[weekRangeLabel(0), weekRangeLabel(1)]}
          prevAriaLabel="שבוע א׳"
          nextAriaLabel="שבוע ב׳"
        />
        {showHighlightPicker || loadReadiness ? (
          <div className="flex items-center gap-2 justify-self-end">
            {loadReadiness ? (
              <div className="w-44 shrink-0 sm:w-52">
                <EmployeeLoadTile
                  scheduleId={scheduleId}
                  versionId={loadReadiness.versionId}
                  revision={loadReadiness.revision}
                  compact
                />
              </div>
            ) : null}
            {showHighlightPicker ? (
              <Select
                value={highlightedEmployeeId ?? NO_HIGHLIGHT}
                onValueChange={(value) => setHighlightedEmployeeId(value === NO_HIGHLIGHT ? null : value)}
              >
                <SelectTrigger
                  className="h-9 w-44 border-border bg-card shadow-[var(--glass-shadow)] sm:w-52"
                  aria-label="בחירת עובד לסימון משמרות"
                >
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
            ) : null}
          </div>
        ) : (
          <div aria-hidden />
        )}
      </div>

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
