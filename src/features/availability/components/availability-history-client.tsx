'use client';
import { PeriodScheduleStatus } from '@/features/schedules/period-status';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ScheduleCalendar } from './schedule-calendar';
import { AVAILABILITY_STATUS_LABEL, type AvailabilityStatus } from '../utils';

export type SubmissionsPeriodPayload = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodScheduleStatus;
  isSubmitted: boolean;
  submissionStatus: AvailabilityStatus;
  entries: Record<string, boolean | 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE'>;
  selectedSlotCount: number;
};

type Props = {
  periods: SubmissionsPeriodPayload[];
};

export function SubmissionsTable({ periods }: Props) {
  const [selectedId, setSelectedId] = useState(periods[0]?.id ?? null);

  const selected = useMemo(() => periods.find((p) => p.id === selectedId) ?? null, [periods, selectedId]);

  if (periods.length === 0) {
    return <p className="text-muted-foreground text-sm">אין תקופות עם הגשות זמינות.</p>;
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {periods.map((p) => {
          const isActive = p.id === selectedId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={cn(
                'rounded-xl border p-4 transition-all w-full text-start',
                'hover:border-foreground/25 hover:bg-muted/30',
                isActive && 'border-foreground/40 bg-muted/50 ring-2 ring-foreground/10',
              )}
            >
              <h2 className="font-semibold leading-snug">{p.name}</h2>
              <p className="text-muted-foreground text-sm mt-1">
                {p.startDate} – {p.endDate}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-muted px-2 py-0.5 text-muted-foreground">{p.status}</span>
                {p.submissionStatus === 'SUBMITTED' ? (
                  <span className="rounded-md bg-green-100 px-2 py-0.5 text-green-800">
                    {AVAILABILITY_STATUS_LABEL.SUBMITTED}
                  </span>
                ) : (
                  <span className="rounded-md border border-border px-2 py-0.5 text-muted-foreground">
                    {AVAILABILITY_STATUS_LABEL[p.submissionStatus]}
                  </span>
                )}
                <span className="text-muted-foreground">{p.selectedSlotCount} משמרות מסומנות</span>
              </div>
            </button>
          );
        })}
      </div>

      {selected ? (
        <ScheduleCalendar
          key={selected.id}
          period={{
            id: selected.id,
            name: selected.name,
            startDate: selected.startDate,
            endDate: selected.endDate,
            status: selected.status,
          }}
          initialEntries={selected.entries}
          initialSubmitted={selected.isSubmitted}
          status={selected.submissionStatus}
          viewOnly
        />
      ) : null}
    </div>
  );
}
