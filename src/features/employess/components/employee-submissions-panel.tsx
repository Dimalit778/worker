'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, FileQuestion, Search } from 'lucide-react';
import { ScheduleCalendar } from '@/features/availability/components/schedule-calendar';
import { cn } from '@/lib/utils';
import type { EmployeeSubmissionPeriod } from '@/features/employess/types';

type EmployeeSubmissionsPanelProps = {
  periods: EmployeeSubmissionPeriod[];
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'טיוטה',
  OPEN: 'פתוחה להגשה',
  LOCKED: 'נעולה',
  PUBLISHED: 'פעילה',
  ARCHIVED: 'בארכיון',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(value),
  );
}

function formatDateTime(value: string | null) {
  if (!value) return 'לא הוגש';

  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function EmployeeSubmissionsPanel({ periods }: EmployeeSubmissionsPanelProps) {
  const [selectedId, setSelectedId] = useState(periods[0]?.id ?? null);
  const [query, setQuery] = useState('');

  const filteredPeriods = useMemo(() => {
    const value = query.trim();
    if (!value) return periods;

    return periods.filter((period) => period.name.includes(value) || period.status.includes(value));
  }, [periods, query]);

  const selected = useMemo(() => periods.find((period) => period.id === selectedId) ?? null, [periods, selectedId]);

  if (periods.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center">
        <FileQuestion className="mx-auto size-9 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm font-medium">אין תקופות להצגה</p>
        <p className="mt-1 text-xs text-muted-foreground">לא נוצרו תקופות שיבוץ עבור בית המשפט.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[23rem_minmax(0,1fr)]">
      <section className="space-y-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש תקופה"
            className="h-10 w-full rounded-md border bg-background pr-9 pl-3 text-sm outline-none transition-colors focus:border-foreground/40"
          />
        </label>

        <div className="space-y-3 pe-1 md:max-h-144 md:overflow-y-auto">
          {filteredPeriods.map((period) => {
            const active = period.id === selectedId;
            return (
              <button
                key={period.id}
                type="button"
                onClick={() => setSelectedId(period.id)}
                className={cn(
                  'w-full rounded-lg border bg-card p-4 text-start shadow-sm transition-all',
                  'hover:border-foreground/25 hover:bg-muted/20',
                  active && 'border-foreground/40 bg-muted/30 ring-2 ring-foreground/10',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{period.name}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(period.startDate)} - {formatDate(period.endDate)}
                    </p>
                  </div>
                  {period.isSubmitted ? (
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-200" aria-hidden />
                  ) : (
                    <Clock3 className="size-5 shrink-0 text-amber-200" aria-hidden />
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
                    {STATUS_LABELS[period.status] ?? period.status}
                  </span>
                  <span
                    className={cn(
                      'rounded-md px-2 py-1 font-medium',
                      period.isSubmitted ? 'bg-emerald-950 text-emerald-200' : 'bg-amber-950 text-amber-200',
                    )}
                  >
                    {period.isSubmitted ? 'הוגש' : 'לא הוגש'}
                  </span>
                  <span className="col-span-2 text-muted-foreground">{period.selectedSlotCount} משמרות מסומנות</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="min-w-0 rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">{selected.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">מועד הגשה: {formatDateTime(selected.submittedAt)}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-muted-foreground">
                  <CalendarDays className="size-3.5" aria-hidden />
                  דדליין {formatDateTime(selected.submissionDeadline)}
                </span>
                <span
                  className={cn(
                    'rounded-md px-2.5 py-1 font-medium',
                    selected.isSubmitted ? 'bg-emerald-950 text-emerald-200' : 'bg-amber-950 text-amber-200',
                  )}
                >
                  {selected.isSubmitted ? 'הוגש' : 'לא הוגש'}
                </span>
              </div>
            </div>

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
              viewOnly
            />
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">בחרו תקופה להצגת ההגשה.</div>
        )}
      </section>
    </div>
  );
}
