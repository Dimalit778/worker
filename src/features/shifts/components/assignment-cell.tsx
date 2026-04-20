'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { GuardPicker } from './guard-picker';
import { assignGuard, reassignGuard, removeAssignment } from '@/features/shifts/actions';
import type { AssignmentSummary, GuardSummary, ShiftType } from '../types';
import type { Position } from '@/generated/prisma/client';

type Props = {
  closed?: boolean;
  assignment: AssignmentSummary | null;
  guards: GuardSummary[];
  scheduleId: string | null;
  periodId: string;
  courtId: string;
  date: string;
  shiftType: ShiftType;
  position: Position;
  slotIndex: number;
  isOpeningDuty: boolean;
  readonly?: boolean;
};

export function AssignmentCell({
  closed = false,
  assignment,
  guards,
  scheduleId,
  periodId,
  courtId,
  date,
  shiftType,
  position,
  slotIndex,
  isOpeningDuty,
  readonly = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [pending, startTransition] = useTransition();
  const tdRef = useRef<HTMLTableCellElement>(null);

  if (closed) {
    return <td className=" bg-black" />;
  }

  if (readonly) {
    return (
      <td className="relative border border-border text-center text-xs min-w-[62px] h-[26px] px-1">
        <span className="truncate block max-w-[58px] mx-auto">{assignment?.userName ?? ''}</span>
      </td>
    );
  }

  function handleSelect(guardId: string) {
    setOpen(false);
    startTransition(async () => {
      if (assignment) {
        await reassignGuard(assignment.id, guardId);
      } else {
        await assignGuard({ scheduleId, periodId, userId: guardId, courtId, date, shiftType, position, slotIndex, isOpeningDuty });
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
        'min-w-[62px] h-[26px] px-1',
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
      <span className="truncate block max-w-[58px] mx-auto">{assignment?.userName ?? ''}</span>

      {open && anchorRect && (
        <GuardPicker
          guards={guards}
          currentUserId={assignment?.userId ?? null}
          anchorRect={anchorRect}
          onSelect={handleSelect}
          onRemove={handleRemove}
          onClose={() => setOpen(false)}
        />
      )}
    </td>
  );
}
