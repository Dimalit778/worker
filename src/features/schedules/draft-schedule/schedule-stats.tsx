'use client';
import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover } from 'radix-ui';
import { EmployeeWarningsPanel } from '@/features/schedules/warnings/components/warnings-panel';
import { groupWarningsByEmployee } from '@/features/schedules/warnings/utils';
import type { ScheduleWarningSummary } from '@/features/schedules/types';
import { SHIFT_LABELS } from '@/features/schedules/constants';
import { useEmployeeLoad, useSubmissionReadiness } from '@/features/schedules/readiness/hooks';
import { SubmissionStatusList } from '@/features/schedules/readiness/components/submission-status-list';
import { EmployeeLoadTable } from '@/features/schedules/readiness/components/employee-load-table';

type ActivePanel = 'errors' | 'submissions' | 'shortages' | 'load' | null;
const SHORTAGE_TYPES = new Set<ScheduleWarningSummary['type']>(['UNFILLED', 'UNDERSTAFFED']);

type MissingEmployee = { id: string; displayName: string; positionName: string | null };

type Props = {
  warnings: ScheduleWarningSummary[];
  hasSchedule?: boolean;
  submittedCount: number;
  eligibleCount: number;
  missingEmployees: MissingEmployee[];
  /** When set, shows detailed submission statuses, shortages and per-employee load (manager draft screen). */
  readiness?: { scheduleId: string; versionId: string | null; revision: number };
};

export function ScheduleStats({ warnings, hasSchedule = true, submittedCount, eligibleCount, missingEmployees, readiness }: Props) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const submissions = useSubmissionReadiness(readiness?.scheduleId).data;
  const load = useEmployeeLoad(readiness?.scheduleId, readiness?.versionId, readiness?.revision, activePanel === 'load');

  const employeeWarnings = hasSchedule ? warnings.filter((w) => w.severity !== 'INFO' && !SHORTAGE_TYPES.has(w.type)) : [];
  const issueCount = employeeWarnings.length;
  const shortages = hasSchedule ? warnings.filter((w) => SHORTAGE_TYPES.has(w.type)) : [];
  const shownSubmitted = submissions ? submissions.counts.SUBMITTED + submissions.counts.UNSUBMITTED_CHANGES : submittedCount;
  const shownEligible = submissions ? submissions.total : eligibleCount;
  const hasPendingSubmissions = submissions ? submissions.counts.SUBMITTED < submissions.total : missingEmployees.length > 0;

  function setPanelOpen(panel: Exclude<ActivePanel, null>, open: boolean) {
    setActivePanel((prev) => (open ? panel : prev === panel ? null : prev));
  }

  const activeGroups = activePanel === 'errors' ? groupWarningsByEmployee(employeeWarnings) : [];

  return (
    <div className={cn('grid grid-cols-2 items-start gap-2', readiness && 'sm:grid-cols-4')} dir="rtl">
      <StatTile
        label="הגשות"
        value={
          <>
            <span className="text-2xl font-bold tracking-tight">{shownSubmitted}</span>
            <span className="text-sm text-muted-foreground"> / {shownEligible}</span>
          </>
        }
        open={activePanel === 'submissions'}
        disabled={readiness ? shownEligible === 0 : !hasPendingSubmissions}
        onOpenChange={(open) => setPanelOpen('submissions', open)}
        panelClassName="w-96"
      >
        {submissions ? (
          <SubmissionStatusList readiness={submissions} showAllEmployees />
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              עובדים שלא הגישו זמינות ({missingEmployees.length})
            </p>
            <div className="flex flex-col gap-1">
              {missingEmployees.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-medium">{emp.displayName}</span>
                  {emp.positionName && <span className="text-xs text-muted-foreground">{emp.positionName}</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </StatTile>
      <StatTile
        label="בעיות"
        value={<span className="text-2xl font-bold tracking-tight">{hasSchedule ? issueCount : '—'}</span>}
        open={activePanel === 'errors'}
        disabled={issueCount === 0}
        tone={issueCount > 0 ? 'danger' : 'neutral'}
        onOpenChange={(open) => setPanelOpen('errors', open)}
        panelClassName="p-3"
      >
        <EmployeeWarningsPanel groups={activeGroups} compact />
      </StatTile>
      {readiness && (
        <>
          <StatTile
            label="חוסר"
            value={<span className="text-2xl font-bold tracking-tight">{hasSchedule ? shortages.length : '—'}</span>}
            open={activePanel === 'shortages'}
            disabled={shortages.length === 0}
            tone={shortages.length > 0 ? 'danger' : 'neutral'}
            onOpenChange={(open) => setPanelOpen('shortages', open)}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              חוסר לפי תקני חובה ({shortages.length})
            </p>
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {shortages.map((w) => (
                <div key={w.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-medium">
                    {[w.date ? `${w.date.slice(8, 10)}/${w.date.slice(5, 7)}` : null, w.shiftType ? SHIFT_LABELS[w.shiftType] : null, w.positionName]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          </StatTile>
          <StatTile
            label="חלוקת משמרות"
            value={<span className="text-sm font-medium">משמרות ושעות לעובד</span>}
            open={activePanel === 'load'}
            disabled={!readiness.versionId}
            onOpenChange={(open) => setPanelOpen('load', open)}
            panelClassName="w-[42rem]"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">חלוקת משמרות ושעות לפי עובד</p>
            {load.isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
            {load.isError && <p className="text-sm text-destructive">לא ניתן לטעון את חלוקת המשמרות.</p>}
            {load.data && <EmployeeLoadTable rows={load.data} />}
          </StatTile>
        </>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  open,
  disabled,
  tone = 'neutral',
  onOpenChange,
  children,
  panelClassName,
}: {
  label: string;
  value: ReactNode;
  open: boolean;
  disabled: boolean;
  tone?: 'neutral' | 'danger';
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  panelClassName?: string;
}) {
  const danger = tone === 'danger';

  return (
    <Popover.Root open={!disabled && open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={!disabled && open}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-end transition-all',
            disabled ? 'cursor-default border-border/60 bg-muted/30' : 'cursor-pointer hover:-translate-y-px hover:shadow-md active:translate-y-0',
            !disabled && danger && (open ? 'border-red-400 bg-red-950 ring-2 ring-red-400' : 'border-red-200 bg-red-950/60'),
            !disabled && !danger && (open ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'border-border/60 bg-muted/30'),
          )}
        >
          <span className="min-w-0">
            <span className={cn('block text-xs font-medium', danger ? 'text-red-200' : 'text-muted-foreground')}>{label}</span>
            <span className={cn('mt-1 block tabular-nums', danger ? 'text-red-200' : 'text-foreground')}>{value}</span>
          </span>
          <ChevronDown
            className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180', danger && 'text-red-500', disabled && 'opacity-40')}
            aria-hidden
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={`פירוט ${label}`}
          dir="rtl"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          sticky="always"
          hideWhenDetached
          className={cn(
            'z-50 w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-24px)] max-h-[var(--radix-popover-content-available-height)] overflow-auto rounded-xl border border-border/60 bg-popover p-4 text-popover-foreground shadow-lg outline-none',
            panelClassName,
          )}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
