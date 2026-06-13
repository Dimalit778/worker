'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { EmployeeWarningsPanel } from '@/features/schedules/warnings/components/warnings-panel';
import { groupWarningsByEmployee } from '@/features/schedules/warnings/utils';
import type { ScheduleWarningSummary } from '@/features/schedules/types';

type ActivePanel = 'errors' | 'warnings' | 'submissions' | null;

type MissingEmployee = { id: string; displayName: string; positionName: string | null };

type Props = {
  warnings: ScheduleWarningSummary[];
  submittedCount: number;
  eligibleCount: number;
  missingEmployees: MissingEmployee[];
};

export function ScheduleStats({ warnings, submittedCount, eligibleCount, missingEmployees }: Props) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const errorWarnings = warnings.filter((w) => w.severity === 'ERROR');
  const otherWarnings = warnings.filter((w) => w.severity !== 'ERROR');
  const errorCount = errorWarnings.length;
  const warningCount = otherWarnings.length;

  const pct = eligibleCount > 0 ? Math.min(100, Math.round((submittedCount / eligibleCount) * 100)) : 0;

  function toggle(panel: ActivePanel) {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }

  const activeGroups =
    activePanel === 'errors'
      ? groupWarningsByEmployee(errorWarnings)
      : activePanel === 'warnings'
        ? groupWarningsByEmployee(otherWarnings)
        : [];

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {/* Submissions — spans full width on mobile */}
        <button
          type="button"
          onClick={() => toggle('submissions')}
          disabled={missingEmployees.length === 0}
          className={cn(
            'col-span-2 sm:col-span-1 rounded-xl border px-4 py-3 text-right transition-all',
            missingEmployees.length === 0
              ? 'border-border/60 bg-muted/30 cursor-default'
              : 'cursor-pointer hover:-translate-y-px hover:shadow-md active:translate-y-0',
            activePanel === 'submissions'
              ? 'border-primary bg-primary/5 ring-2 ring-primary'
              : 'border-border/60 bg-muted/30',
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">הגשות זמינות</p>
          <p className="mt-1 tabular-nums">
            <span className="text-2xl font-bold tracking-tight">{submittedCount}</span>
            <span className="text-sm text-muted-foreground"> / {eligibleCount}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${pct} אחוז הגישו זמינות`}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {missingEmployees.length > 0
              ? `${missingEmployees.length} לא הגישו · לחץ לפרטים`
              : `${pct}% מהעובדים הגישו`}
          </p>
        </button>

        {/* Errors */}
        <button
          type="button"
          onClick={() => toggle('errors')}
          disabled={errorCount === 0}
          className={cn(
            'rounded-xl border px-4 py-3 text-right transition-all',
            errorCount === 0
              ? 'border-border/40 bg-muted/20 cursor-default'
              : 'cursor-pointer hover:-translate-y-px hover:shadow-md active:translate-y-0',
            activePanel === 'errors'
              ? 'border-red-400 bg-red-50 ring-2 ring-red-400'
              : errorCount > 0
                ? 'border-red-200 bg-red-50/60'
                : '',
          )}
        >
          <p className={cn('text-xs font-medium', errorCount > 0 ? 'text-red-600' : 'text-muted-foreground')}>
            שגיאות קריטיות
          </p>
          <p
            className={cn(
              'mt-1 text-2xl font-bold tracking-tight tabular-nums',
              errorCount > 0 ? 'text-red-600' : 'text-muted-foreground',
            )}
          >
            {errorCount}
          </p>
          {errorCount > 0 && (
            <p className="mt-1.5 text-xs text-red-400">{activePanel === 'errors' ? 'לחץ לסגירה ↑' : 'לחץ לפרטים ↓'}</p>
          )}
        </button>

        {/* Warnings + info */}
        <button
          type="button"
          onClick={() => toggle('warnings')}
          disabled={warningCount === 0}
          className={cn(
            'rounded-xl border px-4 py-3 text-right transition-all',
            warningCount === 0
              ? 'border-border/40 bg-muted/20 cursor-default'
              : 'cursor-pointer hover:-translate-y-px hover:shadow-md active:translate-y-0',
            activePanel === 'warnings'
              ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400'
              : warningCount > 0
                ? 'border-amber-200 bg-amber-50/60'
                : '',
          )}
        >
          <p className={cn('text-xs font-medium', warningCount > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
            אזהרות
          </p>
          <p
            className={cn(
              'mt-1 text-2xl font-bold tracking-tight tabular-nums',
              warningCount > 0 ? 'text-amber-600' : 'text-muted-foreground',
            )}
          >
            {warningCount}
          </p>
          {warningCount > 0 && (
            <p className="mt-1.5 text-xs text-amber-400">
              {activePanel === 'warnings' ? 'לחץ לסגירה ↑' : 'לחץ לפרטים ↓'}
            </p>
          )}
        </button>
      </div>

      {/* Collapsible panel */}
      {activePanel === 'submissions' && (
        <Card className="rounded-xl shadow-none border-border/60 animate-in fade-in slide-in-from-top-1 duration-150">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              עובדים שלא הגישו זמינות ({missingEmployees.length})
            </p>
            <div className="flex flex-col gap-1">
              {missingEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{emp.displayName}</span>
                  {emp.positionName && <span className="text-xs text-muted-foreground">{emp.positionName}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(activePanel === 'errors' || activePanel === 'warnings') && activeGroups.length > 0 && (
        <Card className="rounded-xl shadow-none border-border/60 animate-in fade-in slide-in-from-top-1 duration-150">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              {activePanel === 'errors' ? 'שגיאות לפי עובד' : 'אזהרות לפי עובד'}
            </p>
            <EmployeeWarningsPanel groups={activeGroups} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
