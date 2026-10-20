'use client';

import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { GuardPicker, type SwapCandidate } from '@/features/schedules/shared/guard-picker';
import { usePendingEdits } from '@/features/schedules/shared/pending-edits';
import { OverflowCandidates } from '../shared/overflow-candidates';
import type { AssignmentSummary, OverflowCandidateSummary, ScheduleEmployeeOption } from '@/features/schedules/types';
import type { ShiftType } from '@/generated/prisma/client';

/** Table cells ignore min-height; keep vacant rows as tall as filled ones via an inner box. */
const TD_SLOT_INNER = 'flex min-h-6 w-full flex-col items-center justify-center';
const TD_CELL_PAD = 'px-0.5 py-0.5';

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

function TdSlotContent({ children }: { children?: ReactNode }) {
  return <div className={TD_SLOT_INNER}>{children}</div>;
}

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
    : { backgroundColor: mutedPosition ? 'var(--muted)' : positionColor ? `${positionColor}28` : 'var(--card)' };
  const highlightClass =
    'bg-amber-950/60 text-amber-200 ring-1 ring-amber-500/50 ring-inset';

  const rowLayout = as === 'row';

  if (closed) {
    if (anonymousRow) {
      return (
        <Comp
          className={cn(
            'schedule-slot-closed border border-border/60 bg-card',
            rowLayout ? 'flex min-h-11 w-full items-center rounded-md px-3 py-2' : TD_CELL_PAD,
          )}
          aria-hidden
        >
          {rowLayout ? null : <TdSlotContent />}
        </Comp>
      );
    }
    return (
      <Comp
        className={cn(
          'schedule-slot-closed border border-border/60 bg-muted/50',
          rowLayout
            ? 'flex min-h-11 w-full items-center rounded-md px-3 py-2 text-xs text-muted-foreground'
            : TD_CELL_PAD,
        )}
        aria-label="תקן סגור ביום זה"
      >
        {rowLayout ? 'תקן סגור' : <TdSlotContent />}
      </Comp>
    );
  }

  if (readonly) {
    const label = anonymousRow && assignment ? assignment.employeeDisplayName : (assignment?.employeeDisplayName ?? '');
    const labelSpan = !anonymousRow ? (
      <span className={cn('truncate block', rowLayout ? 'max-w-[70%]' : 'mx-auto max-w-full text-xs leading-tight')}>{label}</span>
    ) : null;
    const overflow = !anonymousRow ? <OverflowCandidates candidates={overflowCandidates} /> : null;
    return (
      <Comp
        className={cn(
          'relative border border-border/60 text-center text-xs',
          rowLayout
            ? 'flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-start'
            : TD_CELL_PAD,
          anonymousRow && 'bg-card',
          mutedPosition && 'border-border',
          isHighlighted && !anonymousRow && highlightClass,
        )}
        style={positionStyle}
        aria-label={anonymousRow && assignment ? assignment.employeeDisplayName : undefined}
      >
        {rowLayout ? (
          <>
            {labelSpan}
            {overflow}
          </>
        ) : (
          <TdSlotContent>
            {labelSpan}
            {overflow}
          </TdSlotContent>
        )}
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

  const nameSpan = (
    <span className={cn('truncate block', rowLayout ? 'max-w-[70%]' : 'mx-auto max-w-full text-xs leading-tight')}>
      {assignment?.employeeDisplayName ?? (rowLayout ? 'הקצה עובד' : '')}
    </span>
  );

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
          : TD_CELL_PAD,
        anonymousRow ? 'bg-card' : assignment ? 'hover:bg-accent/60' : 'bg-muted/40 hover:bg-accent/30',
        mutedPosition && 'border-border',
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
      {rowLayout ? (
        <>
          {nameSpan}
          <OverflowCandidates candidates={overflowCandidates} />
        </>
      ) : (
        <TdSlotContent>
          {nameSpan}
          <OverflowCandidates candidates={overflowCandidates} />
        </TdSlotContent>
      )}

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
