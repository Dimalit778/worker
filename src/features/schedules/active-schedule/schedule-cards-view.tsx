'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { calendarDateISO } from '@/features/periods/utils';
import type { AssignmentMap, AssignmentSummary, ScheduleCapacityRule } from '../types';
import { SHIFT_LABELS, SHIFT_ORDER, SHIFT_STYLES, WEEKDAY_HEADER_LETTERS } from '../constants';
import {
  buildScheduleDates,
  createAssignmentCellKey,
  getOrderedPositionsForShift,
  isGuardPositionLabel,
} from '../utils';
import type { ShiftType } from '@/generated/prisma/client';

type ScheduleCardsViewProps = {
  startDate: string;
  endDate: string;
  scheduleName: string;
  assignments: AssignmentMap;
  capacity: ScheduleCapacityRule[];
  currentEmployeeId?: string | null;
};

type DayOption = {
  iso: string;
  dayName: string;
  dateLabel: string;
  isToday: boolean;
};

type DisplayAssignment = AssignmentSummary & {
  positionCode: number;
  positionColor: string | null;
};

const DAY_NAMES = ['יום א', 'יום ב', 'יום ג', 'יום ד', 'יום ה', 'יום ו', 'שבת'] as const;
const SCHEDULE_TIME_ZONE = 'Asia/Jerusalem';

function todayIso(): string {
  return calendarDateISO(new Date(), SCHEDULE_TIME_ZONE);
}

function formatDateLabel(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

function buildDayOptions(startDate: string, endDate: string): DayOption[] {
  const today = todayIso();

  return buildScheduleDates(startDate, endDate).map((iso) => {
    const [year, month, day] = iso.split('-').map(Number);
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    return {
      iso,
      dayName: DAY_NAMES[dayOfWeek],
      dateLabel: formatDateLabel(iso),
      isToday: iso === today,
    };
  });
}

function assignmentsForShift(params: {
  date: string;
  shiftType: ShiftType;
  assignments: AssignmentMap;
  capacity: ScheduleCapacityRule[];
}): DisplayAssignment[] {
  const { date, shiftType, assignments, capacity } = params;
  const positionMeta = new Map(
    getOrderedPositionsForShift(capacity, shiftType).map((position) => [position.positionId, position]),
  );

  const ordered = [...positionMeta.values()].flatMap((position) => {
    const cellKey = createAssignmentCellKey({ date, shiftType, positionId: position.positionId });

    return (assignments[cellKey] ?? []).map((assignment) => ({
      ...assignment,
      positionCode: position.positionCode,
      positionColor: position.positionColor,
    }));
  });

  const knownIds = new Set(positionMeta.keys());
  const extra = Object.entries(assignments)
    .filter(([key]) => key.startsWith(`${date}-${shiftType}-`))
    .flatMap(([, list]) =>
      list
        .filter((assignment) => !knownIds.has(assignment.positionId))
        .map((assignment) => ({
          ...assignment,
          positionCode: Number.MAX_SAFE_INTEGER,
          positionColor: null,
        })),
    );

  return [...ordered, ...extra].sort(
    (a, b) =>
      a.positionCode - b.positionCode ||
      a.slotIndex - b.slotIndex ||
      a.employeeDisplayName.localeCompare(b.employeeDisplayName, 'he'),
  );
}

function ShiftCard({
  shiftType,
  date,
  assignments,
  capacity,
  currentEmployeeId,
}: {
  shiftType: ShiftType;
  date: string;
  assignments: AssignmentMap;
  capacity: ScheduleCapacityRule[];
  currentEmployeeId?: string | null;
}) {
  const style = SHIFT_STYLES[shiftType];
  const shiftAssignments = assignmentsForShift({ date, shiftType, assignments, capacity });
  const currentAssignmentsCount = currentEmployeeId
    ? shiftAssignments.filter((assignment) => assignment.employeeId === currentEmployeeId).length
    : 0;

  return (
    <section className="flex min-h-80 flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className={cn('h-2 shrink-0', style.header)} aria-hidden />
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">{SHIFT_LABELS[shiftType]}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{shiftAssignments.length} עובדים משובצים</p>
        </div>
        {currentAssignmentsCount > 0 ? (
          <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
            השיבוץ שלך
          </span>
        ) : null}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {shiftAssignments.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-4 text-center text-sm text-muted-foreground">
            אין עובדים משובצים במשמרת זו
          </div>
        ) : (
          shiftAssignments.map((assignment) => {
            const isCurrentEmployee = currentEmployeeId === assignment.employeeId;
            const showPosition = !isGuardPositionLabel(assignment.positionName);

            return (
              <div
                key={assignment.id}
                className={cn(
                  'flex min-h-14 items-center gap-3 rounded-md border px-3 py-2 transition-colors',
                  isCurrentEmployee
                    ? 'border-primary/50 bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                    : 'border-border bg-background text-foreground',
                )}
              >
                <span
                  className="h-9 w-1.5 shrink-0 rounded-full bg-muted-foreground/30"
                  style={assignment.positionColor ? { backgroundColor: assignment.positionColor } : undefined}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" title={assignment.employeeDisplayName}>
                    {assignment.employeeDisplayName}
                  </p>
                  {showPosition ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground" title={assignment.positionName}>
                      {assignment.positionName}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  {assignment.slotIndex + 1}
                </span>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export function ScheduleCardsView({
  startDate,
  endDate,
  scheduleName,
  assignments,
  capacity,
  currentEmployeeId,
}: ScheduleCardsViewProps) {
  const days = useMemo(() => buildDayOptions(startDate, endDate), [startDate, endDate]);
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

      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          {days.map((day) => {
            const selected = day.iso === selectedDate;
            const dayLetter = WEEKDAY_HEADER_LETTERS[new Date(`${day.iso}T00:00:00.000Z`).getUTCDay()];

            return (
              <button
                key={day.iso}
                type="button"
                className={cn(
                  'flex h-20 w-24 shrink-0 flex-col items-center justify-center rounded-md border px-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-card text-card-foreground hover:bg-muted',
                )}
                onClick={() => setSelectedDate(day.iso)}
                aria-pressed={selected}
              >
                <span className="text-xs font-medium opacity-80">{day.dayName}</span>
                <span className="mt-1 text-xl font-bold leading-none">{dayLetter}</span>
                <span className="mt-1 text-sm font-semibold">{day.dateLabel}</span>
                {day.isToday ? <span className="mt-1 text-[11px] font-medium opacity-80">היום</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {SHIFT_ORDER.map((shiftType) => (
          <ShiftCard
            key={shiftType}
            shiftType={shiftType}
            date={selectedDate}
            assignments={assignments}
            capacity={capacity}
            currentEmployeeId={currentEmployeeId}
          />
        ))}
      </div>
    </div>
  );
}
