'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { GuardPicker } from './guard-picker';
import { assignEmployeeToSlot, removeAssignment, updateAssignmentEmployee } from '@/features/shift-assignments/actions';
import type { AssignmentSummary, ScheduleEmployeeOption } from '@/features/shift-assignments/types';
import type { ShiftType } from '@/generated/prisma/client';

type Props = {
  closed?: boolean;
  assignment: AssignmentSummary | null;
  employees: ScheduleEmployeeOption[];
  scheduleId: string | null;
  periodId: string;
  courtId: string;
  date: string;
  shiftType: ShiftType;
  positionId: string;
  slotIndex: number;
  readonly?: boolean;
  /** Uniform empty look: no labels, same styling as normal cells; closed slots use muted fill instead of black */
  anonymousRow?: boolean;
};

export function AssignmentCell({
  closed = false,
  assignment,
  employees,
  scheduleId,
  periodId,
  courtId,
  date,
  shiftType,
  positionId,
  slotIndex,
  readonly = false,
  anonymousRow = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [pending, startTransition] = useTransition();
  const tdRef = useRef<HTMLTableCellElement>(null);

  if (closed) {
    if (anonymousRow) {
      return <td className="border border-border bg-muted/30 min-w-[62px] min-h-[26px] px-1 py-0.5" aria-hidden />;
    }
    return <td className="bg-black" />;
  }

  if (readonly) {
    const label = anonymousRow && assignment ? assignment.employeeName : (assignment?.employeeName ?? '');
    return (
      <td
        className="relative border border-border text-center text-xs min-w-[62px] min-h-[26px] px-1 py-0.5"
        aria-label={anonymousRow && assignment ? assignment.employeeName : undefined}
      >
        {!anonymousRow && <span className="truncate block max-w-[58px] mx-auto">{label}</span>}
      </td>
    );
  }

  function handleSelect(employeeId: string) {
    setOpen(false);
    startTransition(async () => {
      if (assignment) {
        await updateAssignmentEmployee(assignment.id, employeeId);
      } else {
        await assignEmployeeToSlot({
          scheduleId,
          periodId,
          employeeId,
          courtId,
          positionId,
          shiftType,
          date,
          slotIndex,
        });
      }
      router.refresh();
    });
  }

  function handleRemove() {
    if (!assignment) return;
    setOpen(false);
    startTransition(async () => {
      await removeAssignment(assignment.id);
      router.refresh();
    });
  }

  return (
    <td
      ref={tdRef}
      className={cn(
        'relative border border-border text-center text-xs cursor-pointer select-none transition-colors',
        'min-w-[62px] min-h-[26px] px-1 py-0.5',
        assignment ? 'hover:bg-accent/60' : 'bg-muted/40 hover:bg-accent/30',
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
      <span className="truncate block max-w-[58px] mx-auto">{assignment?.employeeName ?? ''}</span>

      {open && anchorRect && (
        <GuardPicker
          employees={employees}
          currentUserId={assignment?.employeeId ?? null}
          anchorRect={anchorRect}
          onSelect={handleSelect}
          onRemove={handleRemove}
          onClose={() => setOpen(false)}
        />
      )}
    </td>
  );
}
