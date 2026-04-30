'use client';

import { useState } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';

import type { OverflowCandidateSummary } from '@/features/schedules/types';

type Props = {
  candidates: OverflowCandidateSummary[];
};

export function OverflowCandidates({ candidates }: Props) {
  const [open, setOpen] = useState(false);

  if (candidates.length === 0) return null;

  return (
    <div
      className="mt-1 border-t border-dashed border-border/70 pt-1 text-right"
      dir="rtl"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="mx-auto flex max-w-full items-center gap-0.5 text-[10px] leading-tight text-muted-foreground hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        <span className="truncate">זמינים שלא שובצו ({candidates.length})</span>
      </button>

      {open && (
        <ul className="mt-1 space-y-0.5 text-[10px] leading-tight text-muted-foreground">
          {candidates.map((candidate) => (
            <li key={candidate.employeeId} className="truncate" title={candidate.employeeName}>
              {candidate.employeeName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
