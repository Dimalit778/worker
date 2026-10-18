'use client';
import { useVersionExpectation } from '../shared/version-context';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { calendarDateISO } from '@/features/periods/utils';
import { createAssignment, removeAssignment, updateAssignment } from '@/features/schedules/assignments/actions';
import { applyScheduleEdit } from '@/features/schedules/hooks';
import { ManualOverrideDialog } from '@/features/schedules/shared/manual-override-dialog';
import type { ManualViolation } from '@/features/scheduling-engine/manual-violations';
import type {
  AssignmentMap,
  AssignmentSummary,
  OverflowCandidateMap,
  OverflowCandidateSummary,
  ScheduleCapacityRule,
  ScheduleEmployeeOption,
} from '../types';
import { SHIFT_LABELS, SHIFT_ORDER, SHIFT_STYLES } from '../constants';
import {
  blockedEmployeeIdsForShift,
  buildScheduleDates,
  buildWeekDays,
  createAssignmentCellKey,
  getRequiredForDate,
  getOrderedPositionsForShift,
  isGuardPositionLabel,
} from '../utils';
import type { ShiftType } from '@/generated/prisma/client';
import { GuardPicker } from '../shared/guard-picker';
import { OverflowCandidates } from '../shared/overflow-candidates';

type ScheduleCardsViewProps = {
  scheduleId: string;
  startDate: string;
  endDate: string;
  scheduleName: string;
  assignments: AssignmentMap;
  overflowCandidates?: OverflowCandidateMap;
  employees: ScheduleEmployeeOption[];
  capacity: ScheduleCapacityRule[];
  facilityId: string;
  currentEmployeeId?: string | null;
  readonly?: boolean;
};

type DayOption = {
  iso: string;
  dayName: string;
  dateLabel: string;
  isToday: boolean;
};

type ShiftSlot = {
  key: string;
  positionId: string;
  positionName: string;
  positionRank: number;
  positionColor: string | null;
  slotIndex: number;
  assignment: AssignmentSummary | null;
  overflowCandidates: OverflowCandidateSummary[];
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

function buildPeriodWeekGrids(startDate: string, endDate: string, dayByIso: Map<string, DayOption>) {
  const grids: { weekIndex: number; days: (DayOption | null)[] }[] = [];
  let weekIndex = 0;

  while (weekIndex < 2) {
    const weekDays = buildWeekDays(startDate, weekIndex);
    const days: (DayOption | null)[] = Array.from({ length: 7 }, () => null);
    let hasDayInRange = false;

    for (const weekDay of weekDays) {
      if (weekDay.iso < startDate || weekDay.iso > endDate) continue;

      const day = dayByIso.get(weekDay.iso);
      if (!day) continue;

      days[weekDay.dayOfWeek] = day;
      hasDayInRange = true;
    }

    if (!hasDayInRange) break;

    grids.push({ weekIndex, days });
    weekIndex += 1;
  }

  return grids;
}

function DayPickerButton({
  day,
  selected,
  onSelect,
}: {
  day: DayOption;
  selected: boolean;
  onSelect: (iso: string) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-19 w-17 shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border px-1.5 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
        selected
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : day.isToday
            ? 'border-primary bg-primary/15 text-card-foreground shadow-md ring-2 ring-primary/40'
            : 'border-border bg-card text-card-foreground hover:bg-muted',
      )}
      onClick={() => onSelect(day.iso)}
      aria-pressed={selected}
      aria-current={day.isToday ? 'date' : undefined}
    >
      <span className="w-full truncate text-[10px] leading-tight font-medium opacity-80">
        {day.isToday ? 'היום' : day.dayName}
      </span>

      <span className="text-xs leading-none font-semibold">{day.dateLabel}</span>
    </button>
  );
}

function WeekDayStrip({
  days,
  selectedDate,
  onSelectDate,
}: {
  days: (DayOption | null)[];
  selectedDate: string;
  onSelectDate: (iso: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {days.map((day, index) =>
          day ? (
            <DayPickerButton key={day.iso} day={day} selected={day.iso === selectedDate} onSelect={onSelectDate} />
          ) : (
            <div
              key={`empty-${index}`}
              className="h-19 w-17 shrink-0 rounded-md border border-dashed border-border/60 bg-muted/20"
              aria-hidden
            />
          ),
        )}
      </div>
    </div>
  );
}

function assignedEmployeeIdsForShift(assignments: AssignmentMap, date: string, shiftType: ShiftType): Set<string> {
  return blockedEmployeeIdsForShift(assignments, date, shiftType);
}

function buildShiftSlots(params: {
  date: string;
  shiftType: ShiftType;
  assignments: AssignmentMap;
  overflowCandidates?: OverflowCandidateMap;
  capacity: ScheduleCapacityRule[];
}): ShiftSlot[] {
  const { date, shiftType, assignments, overflowCandidates, capacity } = params;
  const slots: ShiftSlot[] = [];
  const knownPositionIds = new Set<string>();

  for (const position of getOrderedPositionsForShift(capacity, shiftType)) {
    knownPositionIds.add(position.positionId);

    const cellKey = createAssignmentCellKey({ date, shiftType, positionId: position.positionId });
    const assigned = [...(assignments[cellKey] ?? [])].sort((a, b) => a.slotIndex - b.slotIndex);
    const assignedBySlot = new Map(assigned.map((assignment) => [assignment.slotIndex, assignment]));
    const required = getRequiredForDate(capacity, date, shiftType, position.positionId);
    const maxSlotCount = Math.max(required, assigned.length ? Math.max(...assigned.map((a) => a.slotIndex)) + 1 : 0);

    for (let slotIndex = 0; slotIndex < maxSlotCount; slotIndex += 1) {
      const assignment = assignedBySlot.get(slotIndex) ?? null;
      const overflowKey = `${cellKey}-${slotIndex}` as keyof OverflowCandidateMap;

      slots.push({
        key: `${cellKey}-${slotIndex}`,
        positionId: position.positionId,
        positionName: position.positionName,
        positionRank: position.positionRank,
        positionColor: position.positionColor,
        slotIndex,
        assignment,
        overflowCandidates: overflowCandidates?.[overflowKey] ?? [],
      });
    }
  }

  Object.entries(assignments)
    .filter(([key]) => key.startsWith(`${date}-${shiftType}-`))
    .flatMap(([cellKey, list]) =>
      list
        .filter((assignment) => !knownPositionIds.has(assignment.positionId))
        .map((assignment) => {
          const overflowKey = `${cellKey}-${assignment.slotIndex}` as keyof OverflowCandidateMap;

          return {
            key: `${cellKey}-${assignment.slotIndex}`,
            positionId: assignment.positionId,
            positionName: assignment.positionName,
            positionRank: Number.MAX_SAFE_INTEGER,
            positionColor: null,
            slotIndex: assignment.slotIndex,
            assignment,
            overflowCandidates: overflowCandidates?.[overflowKey] ?? [],
          };
        }),
    )
    .forEach((slot) => slots.push(slot));

  return slots.sort(
    (a, b) =>
      a.positionRank - b.positionRank ||
      a.slotIndex - b.slotIndex ||
      a.positionName.localeCompare(b.positionName, 'he'),
  );
}

function resolveEmployeeDisplayName(
  assignment: AssignmentSummary | null,
  employees: ScheduleEmployeeOption[],
): string | null {
  if (!assignment) return null;

  const fromAssignment = assignment.employeeDisplayName.trim();
  if (fromAssignment) return fromAssignment;

  return employees.find((employee) => employee.id === assignment.employeeId)?.displayName ?? null;
}

function AssignmentSlotCard({
  slot,
  shiftType,
  date,
  scheduleId,
  facilityId,
  employees,
  assignedEmployeeIds,
  currentEmployeeId,
  readonly,
}: {
  slot: ShiftSlot;
  shiftType: ShiftType;
  date: string;
  scheduleId: string;
  facilityId: string;
  employees: ScheduleEmployeeOption[];
  assignedEmployeeIds: Set<string>;
  currentEmployeeId?: string | null;
  readonly?: boolean;
}) {
  const queryClient = useQueryClient();
  const expected = useVersionExpectation();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideRequest, setOverrideRequest] = useState<{ violations: ManualViolation[]; input: { type: 'select'; employeeId: string } } | null>(null);

  const assignmentMutation = useMutation({
    mutationFn: async (input: { type: 'select'; employeeId: string; override?: { reason: string } } | { type: 'remove'; assignmentId: string }) => {
      if (input.type === 'remove') {
        return removeAssignment(input.assignmentId, expected);
      }
      if (slot.assignment) {
        return updateAssignment(slot.assignment.id, input.employeeId, expected, input.override);
      }
      return createAssignment({
        scheduleId,
        employeeId: input.employeeId,
        facilityId,
        positionId: slot.positionId,
        shiftType,
        date,
        slotIndex: slot.slotIndex,
      }, expected, input.override);
    },
    onSuccess: (update, input) => {
      if (update && 'requiresOverride' in update) {
        setOverrideRequest({ violations: update.violations, input: input as { type: 'select'; employeeId: string } });
        return;
      }
      return applyScheduleEdit(queryClient, update);
    },
    onError: (e: Error) => setError(e.message || 'שגיאה בשיבוץ'),
  });

  const pending = assignmentMutation.isPending;
  const isCurrentEmployee = currentEmployeeId === slot.assignment?.employeeId;
  const showPosition = !isGuardPositionLabel(slot.positionName);
  const employeeName = resolveEmployeeDisplayName(slot.assignment, employees);
  const emptyLabel = readonly ? 'לא משובץ' : 'בחר עובד';

  function openPicker() {
    if (readonly || pending) return;
    if (anchorRef.current) setAnchorRect(anchorRef.current.getBoundingClientRect());
    setOpen((value) => !value);
  }

  function handleSelect(employeeId: string) {
    setOpen(false);
    setError(null);
    assignmentMutation.mutate({ type: 'select', employeeId });
  }

  function handleRemove() {
    if (!slot.assignment) return;
    const assignmentId = slot.assignment.id;

    setOpen(false);
    setError(null);
    assignmentMutation.mutate({ type: 'remove', assignmentId });
  }

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        type="button"
        className={cn(
          'flex min-h-12 w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-right transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
          isCurrentEmployee
            ? 'border-primary/50 bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/20'
            : slot.assignment
              ? 'border-border bg-background text-foreground'
              : 'border-dashed border-border bg-muted/25 text-muted-foreground',
          !readonly && 'hover:bg-accent/50',
          readonly && 'cursor-default',
          pending && 'pointer-events-none opacity-60',
        )}
        onClick={readonly ? undefined : openPicker}
        aria-disabled={readonly || undefined}
        aria-label={employeeName ? `עריכת שיבוץ ${employeeName}` : 'שיבוץ עובד'}
      >
        <span
          className="h-8 w-1 shrink-0 rounded-full bg-muted-foreground/30"
          style={slot.positionColor ? { backgroundColor: slot.positionColor } : undefined}
          aria-hidden
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-xs font-semibold text-foreground" title={employeeName ?? undefined}>
            {employeeName ?? emptyLabel}
          </p>
          {showPosition ? (
            <p className="truncate text-[11px] leading-tight text-muted-foreground" title={slot.positionName}>
              {slot.positionName}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {slot.slotIndex + 1}
        </span>
      </button>

      {error ? (
        <p className="mt-1 rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <OverflowCandidates candidates={slot.overflowCandidates} />

      {open && anchorRect ? (
        <GuardPicker
          employees={employees}
          disabledEmployeeIds={assignedEmployeeIds}
          currentUserId={slot.assignment?.employeeId ?? null}
          anchorRect={anchorRect}
          onSelect={handleSelect}
          onRemove={handleRemove}
          onClose={() => setOpen(false)}
        />
      ) : null}
      <ManualOverrideDialog
        violations={overrideRequest?.violations ?? null}
        onCancel={() => setOverrideRequest(null)}
        onConfirm={reason => {
          if (overrideRequest) assignmentMutation.mutate({ ...overrideRequest.input, override: { reason } });
          setOverrideRequest(null);
        }}
      />
    </div>
  );
}

function ShiftCard({
  shiftType,
  date,
  scheduleId,
  facilityId,
  assignments,
  overflowCandidates,
  employees,
  capacity,
  currentEmployeeId,
  readonly,
}: {
  shiftType: ShiftType;
  date: string;
  scheduleId: string;
  facilityId: string;
  assignments: AssignmentMap;
  overflowCandidates?: OverflowCandidateMap;
  employees: ScheduleEmployeeOption[];
  capacity: ScheduleCapacityRule[];
  currentEmployeeId?: string | null;
  readonly?: boolean;
}) {
  const style = SHIFT_STYLES[shiftType];
  const shiftSlots = buildShiftSlots({ date, shiftType, assignments, overflowCandidates, capacity });
  const assignedEmployeeIds = assignedEmployeeIdsForShift(assignments, date, shiftType);
  const assignedCount = shiftSlots.filter((slot) => slot.assignment).length;
  const currentAssignmentsCount = currentEmployeeId
    ? shiftSlots.filter((slot) => slot.assignment?.employeeId === currentEmployeeId).length
    : 0;

  return (
    <section className="flex min-h-60 flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className={cn('h-1.5 shrink-0', style.header)} aria-hidden />
      <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div>
          <h2 className="text-base font-semibold text-card-foreground">{SHIFT_LABELS[shiftType]}</h2>
          <p className="text-[11px] text-muted-foreground">
            {assignedCount}/{shiftSlots.length} עובדים משובצים
          </p>
        </div>
        {currentAssignmentsCount > 0 ? (
          <span className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
            השיבוץ שלך
          </span>
        ) : null}
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {shiftSlots.length === 0 ? (
          <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-3 text-center text-xs text-muted-foreground">
            אין תקנים למשמרת זו
          </div>
        ) : (
          shiftSlots.map((slot) => (
            <AssignmentSlotCard
              key={slot.key}
              slot={slot}
              shiftType={shiftType}
              date={date}
              scheduleId={scheduleId}
              facilityId={facilityId}
              employees={employees}
              assignedEmployeeIds={assignedEmployeeIds}
              currentEmployeeId={currentEmployeeId}
              readonly={readonly}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function ScheduleCardsView({
  scheduleId,
  startDate,
  endDate,
  scheduleName,
  assignments,
  overflowCandidates,
  employees,
  capacity,
  facilityId,
  currentEmployeeId,
  readonly,
}: ScheduleCardsViewProps) {
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

      <div className="w-full overflow-x-auto pb-1">
        <div
          className={cn(
            'flex w-full min-w-max gap-10',
            periodWeekGrids.length > 1 ? 'justify-between' : 'justify-start',
          )}
        >
          {periodWeekGrids.map((week) => (
            <WeekDayStrip
              key={week.weekIndex}
              days={week.days}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {SHIFT_ORDER.map((shiftType) => (
          <ShiftCard
            key={shiftType}
            shiftType={shiftType}
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
        ))}
      </div>
    </div>
  );
}
