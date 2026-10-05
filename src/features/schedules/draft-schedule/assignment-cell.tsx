'use client';

import { useVersionExpectation } from '@/features/schedules/shared/version-context';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { GuardPicker, type SwapCandidate } from '@/features/schedules/shared/guard-picker';
import { createAssignment, removeAssignment, swapAssignments, updateAssignment } from '@/features/schedules/assignments/actions';
import { applyScheduleEdit } from '@/features/schedules/hooks';
import { OverflowCandidates } from '../shared/overflow-candidates';
import type { AssignmentSummary, OverflowCandidateSummary, ScheduleEmployeeOption } from '@/features/schedules/types';
import type { ShiftType } from '@/generated/prisma/client';

type Props = {
  closed?: boolean;
  assignment: AssignmentSummary | null;
  employees: ScheduleEmployeeOption[];
  assignedEmployeeIds?: Set<string>;
  scheduleId: string;
  facilityId: string;
  date: string;
  shiftType: ShiftType;
  positionId: string;
  positionColor?: string | null;
  mutedPosition?: boolean;
  slotIndex: number;
  overflowCandidates?: OverflowCandidateSummary[];
  readonly?: boolean;
  anonymousRow?: boolean;
  highlightedEmployeeId?: string | null;
  swapCandidates?: SwapCandidate[];
};

export function AssignmentCell({
  closed = false,
  assignment,
  employees,
  assignedEmployeeIds,
  scheduleId,
  facilityId,
  date,
  shiftType,
  positionId,
  positionColor,
  mutedPosition = false,
  slotIndex,
  overflowCandidates = [],
  readonly = false,
  anonymousRow = false,
  highlightedEmployeeId = null,
  swapCandidates = [],
}: Props) {
  const queryClient = useQueryClient();
  const expected = useVersionExpectation();
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tdRef = useRef<HTMLTableCellElement>(null);

  const assignmentMutation = useMutation({
    mutationFn: async (
      input:
        | { type: 'select'; employeeId: string }
        | { type: 'remove'; assignmentId: string }
        | { type: 'swap'; assignmentId: string },
    ) => {
      if (input.type === 'remove') {
        return removeAssignment(input.assignmentId, expected);
      }
      if (input.type === 'swap') {
        if (!assignment) return;
        return swapAssignments(assignment.id, input.assignmentId, expected);
      }
      if (assignment) {
        return updateAssignment(assignment.id, input.employeeId, expected);
      }
      return createAssignment({
        scheduleId,
        employeeId: input.employeeId,
        facilityId,
        positionId,
        shiftType,
        date,
        slotIndex,
      }, expected);
    },
    onSuccess: update => applyScheduleEdit(queryClient, update),
    onError: (e: Error) => setError(e.message || 'שגיאה בשיבוץ'),
  });

  const pending = assignmentMutation.isPending;
  const isHighlighted = Boolean(highlightedEmployeeId && assignment?.employeeId === highlightedEmployeeId);
  const positionStyle = (positionColor === undefined && !mutedPosition) || isHighlighted || anonymousRow
    ? undefined
    : { backgroundColor: mutedPosition ? '#e5e7eb' : positionColor ? `${positionColor}28` : '#ffffff' };
  const highlightClass =
    'bg-amber-200/90 text-amber-950 ring-2 ring-amber-500 ring-inset shadow-[inset_0_0_0_1px_rgba(245,158,11,0.45)]';

  if (closed) {
    if (anonymousRow) {
      return <td className="border border-border bg-white min-w-[62px] min-h-[26px] px-1 py-0.5" aria-hidden />;
    }
    return <td className="border border-gray-300 bg-gray-200" />;
  }

  if (readonly) {
    const label = anonymousRow && assignment ? assignment.employeeDisplayName : (assignment?.employeeDisplayName ?? '');
    return (
      <td
        className={cn(
          'relative border border-border text-center text-xs min-w-[62px] min-h-[26px] px-1 py-0.5',
          anonymousRow && 'bg-white',
          mutedPosition && 'border-gray-300',
          isHighlighted && !anonymousRow && highlightClass,
        )}
        style={positionStyle}
        aria-label={anonymousRow && assignment ? assignment.employeeDisplayName : undefined}
      >
        {!anonymousRow && <span className="truncate block max-w-[58px] mx-auto">{label}</span>}
        {!anonymousRow && <OverflowCandidates candidates={overflowCandidates} />}
      </td>
    );
  }

  function handleSelect(employeeId: string) {
    setOpen(false);
    setError(null);
    assignmentMutation.mutate({ type: 'select', employeeId });
  }

  function handleRemove() {
    if (!assignment) return;
    setOpen(false);
    setError(null);
    assignmentMutation.mutate({ type: 'remove', assignmentId: assignment.id });
  }

  function handleSwap(candidateAssignmentId: string) {
    setOpen(false);
    setError(null);
    assignmentMutation.mutate({ type: 'swap', assignmentId: candidateAssignmentId });
  }

  return (
    <td
      ref={tdRef}
      style={positionStyle}
      className={cn(
        'relative border border-border text-center text-xs cursor-pointer select-none transition-colors',
        'min-w-[62px] min-h-[26px] px-1 py-0.5',
        anonymousRow ? 'bg-white' : assignment ? 'hover:bg-accent/60' : 'bg-muted/40 hover:bg-accent/30',
        mutedPosition && 'border-gray-300',
        isHighlighted && !anonymousRow && highlightClass,
        pending && 'opacity-50 pointer-events-none',
        open && 'ring-2 ring-primary ring-inset',
      )}
      onClick={() => {
        if (!open && tdRef.current) {
          setAnchorRect(tdRef.current.getBoundingClientRect());
        }
        setOpen((v) => !v);
      }}
    >
      <span className="truncate block max-w-[58px] mx-auto">{assignment?.employeeDisplayName ?? ''}</span>
      {error && (
        <span className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-600 text-[10px] leading-tight px-0.5 z-10">
          {error}
        </span>
      )}
      <OverflowCandidates candidates={overflowCandidates} />

      {open && anchorRect && (
        <GuardPicker
          employees={employees}
          disabledEmployeeIds={assignedEmployeeIds}
          currentUserId={assignment?.employeeId ?? null}
          anchorRect={anchorRect}
          onSelect={handleSelect}
          onRemove={handleRemove}
          onClose={() => setOpen(false)}
          swapCandidates={assignment ? swapCandidates : undefined}
          onSwap={assignment ? handleSwap : undefined}
        />
      )}
    </td>
  );
}
