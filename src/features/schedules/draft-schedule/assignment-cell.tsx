'use client';

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { GuardPicker } from '@/features/schedules/shared/guard-picker';
import { createAssignment, removeAssignment, updateAssignment } from '@/features/schedules/assignments/actions';
import { invalidateScheduleQueries } from '@/features/schedules/hooks';
import { OverflowCandidates } from '../shared/overflow-candidates';
import type { AssignmentSummary, OverflowCandidateSummary, ScheduleEmployeeOption } from '@/features/schedules/types';
import type { ShiftType } from '@/generated/prisma/client';

type Props = {
  closed?: boolean;
  assignment: AssignmentSummary | null;
  employees: ScheduleEmployeeOption[];
  assignedEmployeeIds?: Set<string>;
  scheduleId: string;
  courtId: string;
  date: string;
  shiftType: ShiftType;
  positionId: string;
  slotIndex: number;
  overflowCandidates?: OverflowCandidateSummary[];
  readonly?: boolean;
  anonymousRow?: boolean;
};

export function AssignmentCell({
  closed = false,
  assignment,
  employees,
  assignedEmployeeIds,
  scheduleId,
  courtId,
  date,
  shiftType,
  positionId,
  slotIndex,
  overflowCandidates = [],
  readonly = false,
  anonymousRow = false,
}: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tdRef = useRef<HTMLTableCellElement>(null);

  const assignmentMutation = useMutation({
    mutationFn: async (input: { type: 'select'; employeeId: string } | { type: 'remove'; assignmentId: string }) => {
      if (input.type === 'remove') {
        await removeAssignment(input.assignmentId);
        return;
      }
      if (assignment) {
        await updateAssignment(assignment.id, input.employeeId);
        return;
      }
      await createAssignment({
        scheduleId,
        employeeId: input.employeeId,
        courtId,
        positionId,
        shiftType,
        date,
        slotIndex,
      });
    },
    onSuccess: () => invalidateScheduleQueries(queryClient, scheduleId),
    onError: (e: Error) => setError(e.message || 'שגיאה בשיבוץ'),
  });

  const pending = assignmentMutation.isPending;

  if (closed) {
    if (anonymousRow) {
      return <td className="border border-border bg-white min-w-[62px] min-h-[26px] px-1 py-0.5" aria-hidden />;
    }
    return <td className="bg-gray-200" />;
  }

  if (readonly) {
    const label = anonymousRow && assignment ? assignment.employeeDisplayName : (assignment?.employeeDisplayName ?? '');
    return (
      <td
        className={cn(
          'relative border border-border text-center text-xs min-w-[62px] min-h-[26px] px-1 py-0.5',
          anonymousRow && 'bg-white',
        )}
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

  return (
    <td
      ref={tdRef}
      className={cn(
        'relative border border-border text-center text-xs cursor-pointer select-none transition-colors',
        'min-w-[62px] min-h-[26px] px-1 py-0.5',
        anonymousRow ? 'bg-white' : assignment ? 'hover:bg-accent/60' : 'bg-muted/40 hover:bg-accent/30',
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
          currentUserId={assignment?.employeeId ?? null}
          disabledEmployeeIds={assignedEmployeeIds}
          anchorRect={anchorRect}
          onSelect={handleSelect}
          onRemove={handleRemove}
          onClose={() => setOpen(false)}
        />
      )}
    </td>
  );
}
