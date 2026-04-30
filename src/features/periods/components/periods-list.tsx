'use client';

import { useTransition } from 'react';
import { updatePeriodStatus, deletePeriod } from '../actions';
import { PeriodSummary } from '../types';
import { PERIOD_STATUS_HE, NEXT_STATUS, STATUS_BADGE } from '../constants';
import { cn } from '@/lib/utils';
import { formatDate } from '../utils';

const PeriodRow = ({ period }: { period: PeriodSummary }) => {
  const [statusPending, startStatusTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const next = NEXT_STATUS[period.status];
  const pending = statusPending || deletePending;

  function handleStatusChange() {
    if (!next) return;
    startStatusTransition(async () => {
      await updatePeriodStatus(period.id, next.status);
    });
  }

  function handleDelete() {
    if (!confirm(`למחוק את התקופה "${period.name}"? הפעולה תמחק גם את כל ההגשות והשיבוצים שלה.`)) return;
    startDeleteTransition(async () => {
      await deletePeriod(period.id);
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 border-border hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{period.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDate(period.startDate)} – {formatDate(period.endDate)}
        </p>
      </div>

      <div className="text-center hidden sm:block">
        <p className="text-xs text-muted-foreground">הגשות</p>
        <p className="text-sm font-semibold">
          {period.submittedCount}
          <span className="text-muted-foreground font-normal">/{period.totalGuards}</span>
        </p>
      </div>

      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full shrink-0', STATUS_BADGE[period.status])}>
        {PERIOD_STATUS_HE[period.status]}
      </span>

      {next && (
        <button
          onClick={handleStatusChange}
          disabled={pending}
          className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent transition-colors shrink-0 disabled:opacity-40"
        >
          {statusPending ? '...' : next.label}
        </button>
      )}

      <button
        onClick={handleDelete}
        disabled={pending}
        title="מחק תקופה"
        className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-40"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6.5 1.75a.25.25 0 0 1 .25-.25h2.5a.25.25 0 0 1 .25.25V3h-3V1.75Zm4.5 0V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.559a.75.75 0 1 0-1.492.141l.675 7.17A1.75 1.75 0 0 0 5.423 15.5h5.154a1.75 1.75 0 0 0 1.744-1.63l.675-7.17a.75.75 0 1 0-1.492-.141l-.675 7.17a.25.25 0 0 1-.249.232H5.423a.25.25 0 0 1-.249-.233L4.496 6.56Z" />
        </svg>
      </button>
    </div>
  );
};

export function PeriodsList({ periods }: { periods: PeriodSummary[] }) {
  if (periods.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">אין תקופות — צור תקופה חדשה כדי להתחיל.</p>;
  }

  return (
    <div className="divide-y-0">
      {periods.map((p) => (
        <PeriodRow key={p.id} period={p} />
      ))}
    </div>
  );
}
