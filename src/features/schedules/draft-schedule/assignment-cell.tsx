'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { GuardPicker, type SwapCandidate } from '@/features/schedules/shared/guard-picker';
import { usePendingEdits } from '@/features/schedules/shared/pending-edits';
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
  /** 'td' (default) renders inside the desktop table grid; 'row' renders a standalone full-width
   *  mobile list row with the same interaction/mutation logic, for the Day → Shift → Position layout. */
  as?: 'td' | 'row';
};

export function AssignmentCell({
  closed = false,
  assignment,
  employees,
  assignedEmployeeIds,
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
  as = 'td',
}: Props) {
  const edits = usePendingEdits();
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  // Shared between the <td> (desktop grid) and <div> (mobile row) render paths.
  const tdRef = useRef<HTMLTableCellElement | HTMLDivElement>(null);
  const Comp = as === 'row' ? 'div' : 'td';
  const slotRef = { date, shiftType, positionId, slotIndex };
  const unsaved = edits?.isDirty(slotRef) ?? false;

  const isHighlighted = Boolean(highlightedEmployeeId && assignment?.employeeId === highlightedEmployeeId);
  const positionStyle = (positionColor === undefined && !mutedPosition) || isHighlighted || anonymousRow
    ? undefined
    : { backgroundColor: mutedPosition ? '#e5e7eb' : positionColor ? `${positionColor}28` : '#ffffff' };
  const highlightClass =
    'bg-amber-200/90 text-amber-950 ring-2 ring-amber-500 ring-inset shadow-[inset_0_0_0_1px_rgba(245,158,11,0.45)]';

  const rowLayout = as === 'row';

  if (closed) {
    if (anonymousRow) {
      return (
        <Comp
          className={cn(
            'schedule-slot-closed border border-border/60 bg-card',
            rowLayout ? 'flex min-h-11 w-full items-center rounded-md px-3 py-2' : 'min-w-[62px] min-h-[32px] px-1 py-0.5',
          )}
          aria-hidden
        />
      );
    }
    return (
      <Comp
        className={cn(
          'schedule-slot-closed border border-border/60 bg-muted/50',
          rowLayout && 'flex min-h-11 w-full items-center rounded-md px-3 py-2 text-xs text-muted-foreground',
        )}
        aria-label="תקן סגור ביום זה"
      >
        {rowLayout ? 'תקן סגור' : null}
      </Comp>
    );
  }

  if (readonly) {
    const label = anonymousRow && assignment ? assignment.employeeDisplayName : (assignment?.employeeDisplayName ?? 'חסר עובד');
    return (
      <Comp
        className={cn(
          'relative border border-border/60 text-center text-xs',
          rowLayout
            ? 'flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-start'
            : 'min-w-[62px] min-h-[32px] px-1 py-0.5',
          anonymousRow && 'bg-card',
          mutedPosition && 'border-gray-300',
          isHighlighted && !anonymousRow && highlightClass,
        )}
        style={positionStyle}
        aria-label={anonymousRow && assignment ? assignment.employeeDisplayName : undefined}
      >
        {!anonymousRow && <span className={cn('truncate block', rowLayout ? 'max-w-[70%]' : 'max-w-[58px] mx-auto')}>{label}</span>}
        {!anonymousRow && <OverflowCandidates candidates={overflowCandidates} />}
      </Comp>
    );
  }

  function handleSelect(employeeId: string) {
    setOpen(false);
    edits?.setSlot(slotRef, employeeId);
  }

  function handleRemove() {
    if (!assignment) return;
    setOpen(false);
    edits?.setSlot(slotRef, null);
  }

  function handleSwap(candidateAssignmentId: string) {
    setOpen(false);
    edits?.swapWith(slotRef, candidateAssignmentId);
  }

  function openPicker() {
    if (tdRef.current) {
      setAnchorRect(tdRef.current.getBoundingClientRect());
    }
    setOpen((v) => !v);
  }

  const cellLabel = `${date} ${shiftType} — ${assignment?.employeeDisplayName ?? 'תקן פנוי'}`;

  return (
    <Comp
      ref={tdRef as never}
      style={positionStyle}
      role="button"
      tabIndex={0}
      aria-label={cellLabel}
      className={cn(
        'relative border border-border/60 text-center text-xs cursor-pointer select-none transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        rowLayout
          ? 'flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-start'
          : 'min-w-[62px] min-h-[32px] px-1 py-0.5',
        anonymousRow ? 'bg-card' : assignment ? 'hover:bg-accent/60' : 'bg-muted/40 hover:bg-accent/30',
        mutedPosition && 'border-gray-300',
        isHighlighted && !anonymousRow && highlightClass,
        unsaved && 'outline outline-2 -outline-offset-2 outline-dashed outline-primary',
        open && 'ring-2 ring-primary ring-inset',
      )}
      onClick={(e: React.MouseEvent) => {
        // Clicks inside portaled children (picker, override dialog) bubble here through React; ignore them.
        if (!tdRef.current?.contains(e.target as Node)) return;
        openPicker();
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.target !== tdRef.current) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      }}
    >
      <span className={cn('truncate block', rowLayout ? 'max-w-[70%]' : 'max-w-[58px] mx-auto')}>
        {assignment?.employeeDisplayName ?? (rowLayout ? 'הקצה עובד' : '')}
      </span>
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
    </Comp>
  );
}
