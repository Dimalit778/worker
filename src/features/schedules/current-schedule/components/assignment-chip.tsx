'use client';

import { useVersionExpectation } from '@/features/schedules/shared/version-context';
import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createAssignment, removeAssignment, swapAssignments, updateAssignment } from '@/features/schedules/assignments/actions';
import { applyScheduleEdit } from '@/features/schedules/hooks';
import { ManualOverrideDialog } from '@/features/schedules/shared/manual-override-dialog';
import type { ManualViolation } from '@/features/scheduling-engine/manual-violations';
import type { ScheduleEmployeeOption } from '@/features/schedules/types';
import type { ShiftType } from '@/generated/prisma/client';
import { GuardPicker, type SwapCandidate } from '@/features/schedules/shared/guard-picker';
import type { ShiftSlot } from '../types';

function resolveEmployeeDisplayName(slot: ShiftSlot, employees: ScheduleEmployeeOption[]): string | null {
  if (!slot.assignment) return null;

  const fromAssignment = slot.assignment.employeeDisplayName.trim();
  if (fromAssignment) return fromAssignment;

  return employees.find((employee) => employee.id === slot.assignment?.employeeId)?.displayName ?? null;
}

type AssignmentPickerProps = {
  slot: ShiftSlot;
  shiftType: ShiftType;
  date: string;
  scheduleId: string;
  facilityId: string;
  employees: ScheduleEmployeeOption[];
  assignedEmployeeIds: Set<string>;
  readonly?: boolean;
  mode: 'add' | 'edit';
  children: ReactNode;
  className?: string;
  ariaLabel: string;
  swapCandidates?: SwapCandidate[];
};

function AssignmentPicker({
  slot,
  shiftType,
  date,
  scheduleId,
  facilityId,
  employees,
  assignedEmployeeIds,
  readonly,
  mode,
  children,
  className,
  ariaLabel,
  swapCandidates = [],
}: AssignmentPickerProps) {
  const queryClient = useQueryClient();
  const expected = useVersionExpectation();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideRequest, setOverrideRequest] = useState<{ violations: ManualViolation[]; input: { type: 'select'; employeeId: string } | { type: 'swap'; assignmentId: string } } | null>(null);

  const assignmentMutation = useMutation({
    mutationFn: async (
      input:
        | { type: 'select'; employeeId: string; override?: { reason: string } }
        | { type: 'remove'; assignmentId: string }
        | { type: 'swap'; assignmentId: string; override?: { reason: string } },
    ) => {
      if (input.type === 'remove') {
        return removeAssignment(input.assignmentId, expected);
      }
      if (input.type === 'swap') {
        if (!slot.assignment) return;
        return swapAssignments(slot.assignment.id, input.assignmentId, expected, input.override);
      }
      if (mode === 'edit' && slot.assignment) {
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
        setOverrideRequest({ violations: update.violations, input: input as Extract<typeof input, { type: 'select' | 'swap' }> });
        return;
      }
      return applyScheduleEdit(queryClient, update);
    },
    onError: (e: Error) => setError(e.message || 'שגיאה בשיבוץ'),
  });

  const pending = assignmentMutation.isPending;

  function openPicker() {
    if (readonly || pending) return;
    if (anchorRef.current) setAnchorRect(anchorRef.current.getBoundingClientRect());
    setOpen(true);
  }

  function handleSelect(employeeId: string) {
    setOpen(false);
    setError(null);
    assignmentMutation.mutate({ type: 'select', employeeId });
  }

  function handleRemove() {
    if (!slot.assignment) return;
    setOpen(false);
    setError(null);
    assignmentMutation.mutate({ type: 'remove', assignmentId: slot.assignment.id });
  }

  function handleSwap(candidateAssignmentId: string) {
    setOpen(false);
    setError(null);
    assignmentMutation.mutate({ type: 'swap', assignmentId: candidateAssignmentId });
  }

  return (
    <div className="min-w-0">
      <button
        ref={anchorRef}
        type="button"
        className={className}
        onClick={readonly ? undefined : openPicker}
        aria-disabled={readonly || undefined}
        aria-label={ariaLabel}
      >
        {children}
      </button>

      {error ? (
        <p className="mt-1 rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {open && anchorRect ? (
        <GuardPicker
          employees={employees}
          disabledEmployeeIds={assignedEmployeeIds}
          currentUserId={slot.assignment?.employeeId ?? null}
          anchorRect={anchorRect}
          onSelect={handleSelect}
          onRemove={mode === 'edit' ? handleRemove : () => {}}
          onClose={() => setOpen(false)}
          swapCandidates={mode === 'edit' ? swapCandidates : undefined}
          onSwap={mode === 'edit' ? handleSwap : undefined}
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

export function RoleAddButton({
  slot,
  role,
  shiftType,
  date,
  scheduleId,
  facilityId,
  employees,
  assignedEmployeeIds,
}: {
  slot: ShiftSlot;
  role: string;
  shiftType: ShiftType;
  date: string;
  scheduleId: string;
  facilityId: string;
  employees: ScheduleEmployeeOption[];
  assignedEmployeeIds: Set<string>;
}) {
  return (
    <AssignmentPicker
      slot={slot}
      shiftType={shiftType}
      date={date}
      scheduleId={scheduleId}
      facilityId={facilityId}
      employees={employees}
      assignedEmployeeIds={assignedEmployeeIds}
      mode="add"
      ariaLabel={`הוסף ${role}`}
      className="flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <Plus className="size-4" aria-hidden />
    </AssignmentPicker>
  );
}

export function AssignmentChip({
  slot,
  shiftType,
  date,
  scheduleId,
  facilityId,
  employees,
  assignedEmployeeIds,
  currentEmployeeId,
  readonly,
  swapCandidates,
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
  swapCandidates?: SwapCandidate[];
}) {
  if (!slot.assignment) return null;

  const isCurrentEmployee = currentEmployeeId === slot.assignment.employeeId;
  const employeeName = resolveEmployeeDisplayName(slot, employees);

  return (
    <AssignmentPicker
      slot={slot}
      shiftType={shiftType}
      date={date}
      scheduleId={scheduleId}
      facilityId={facilityId}
      employees={employees}
      assignedEmployeeIds={assignedEmployeeIds}
      readonly={readonly}
      mode="edit"
      swapCandidates={swapCandidates}
      ariaLabel={employeeName ? `עריכת שיבוץ ${employeeName}` : 'שיבוץ עובד'}
      className={cn(
        'flex min-h-8 min-w-24 items-center justify-between gap-2 rounded-md border px-2 py-1 text-right text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
        isCurrentEmployee
          ? 'border-primary/50 bg-primary/10 font-semibold text-primary ring-1 ring-primary/20'
          : 'border-border bg-card text-foreground hover:bg-muted',
        readonly && 'cursor-default hover:bg-card',
      )}
    >
      <span className="truncate">{employeeName}</span>
      {isCurrentEmployee ? <UserCheck className="size-3.5 shrink-0" aria-hidden /> : null}
    </AssignmentPicker>
  );
}
