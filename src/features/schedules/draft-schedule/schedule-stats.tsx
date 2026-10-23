'use client';
import { useState, type ReactNode } from 'react';
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
  /** When false, omit the load tile (e.g. rendered elsewhere on the page). Default true. */
  showLoadTile?: boolean;
  /** `inline` = compact row for the week toolbar; `grid` = full-width cards. */
  layout?: 'grid' | 'inline';
};

export function ScheduleStats({
  warnings,
  hasSchedule = true,
  submittedCount,
  eligibleCount,
  missingEmployees,
  readiness,
  showLoadTile = true,
  layout = 'grid',
}: Props) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const submissions = useSubmissionReadiness(readiness?.scheduleId).data;
  const compact = layout === 'inline';

  const employeeWarnings = hasSchedule ? warnings.filter((w) => w.severity !== 'INFO' && !SHORTAGE_TYPES.has(w.type)) : [];
  const issueCount = employeeWarnings.length;
  const shortages = hasSchedule ? warnings.filter((w) => SHORTAGE_TYPES.has(w.type)) : [];
  const shownSubmitted = submissions ? submissions.counts.SUBMITTED + submissions.counts.UNSUBMITTED_CHANGES : submittedCount;
  const shownEligible = submissions ? submissions.total : eligibleCount;
  const hasPendingSubmissions = submissions ? submissions.counts.SUBMITTED < submissions.total : missingEmployees.length > 0;
  const showShortages = Boolean(readiness);
  const showLoad = Boolean(readiness) && showLoadTile;
  const tileCount = 2 + (showShortages ? 1 : 0) + (showLoad ? 1 : 0);
  const valueClass = compact ? 'text-lg font-bold tracking-tight' : 'text-2xl font-bold tracking-tight';
  const mutedClass = compact ? 'text-sm text-muted-foreground' : 'text-sm text-muted-foreground';

  function setPanelOpen(panel: Exclude<ActivePanel, null>, open: boolean) {
    setActivePanel((prev) => (open ? panel : prev === panel ? null : prev));
  }

  const activeGroups = activePanel === 'errors' ? groupWarningsByEmployee(employeeWarnings) : [];

  const inlineCols =
    tileCount >= 3 ? 'grid-cols-3' : tileCount === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <div
      className={cn(
        compact
          ? cn('grid w-full items-stretch gap-2', inlineCols)
          : cn('grid grid-cols-2 items-start gap-3', tileCount >= 4 && 'sm:grid-cols-4', tileCount === 3 && 'sm:grid-cols-3'),
      )}
      dir="rtl"
    >
      <StatTile
        label="הגשות"
        value={
          <>
            <span className={valueClass}>{shownSubmitted}</span>
            <span className={mutedClass}> / {shownEligible}</span>
          </>
        }
        open={activePanel === 'submissions'}
        disabled={readiness ? shownEligible === 0 : !hasPendingSubmissions}
        onOpenChange={(open) => setPanelOpen('submissions', open)}
        panelClassName="w-96"
        compact={compact}
        className={compact ? 'w-full' : undefined}
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
        value={<span className={valueClass}>{hasSchedule ? issueCount : '—'}</span>}
        open={activePanel === 'errors'}
        disabled={issueCount === 0}
        tone={issueCount > 0 ? 'danger' : 'neutral'}
        onOpenChange={(open) => setPanelOpen('errors', open)}
        panelClassName="p-3"
        compact={compact}
        className={compact ? 'w-full' : undefined}
      >
        <EmployeeWarningsPanel groups={activeGroups} compact />
      </StatTile>
      {showShortages && (
        <StatTile
          label="חוסר"
          value={<span className={valueClass}>{hasSchedule ? shortages.length : '—'}</span>}
          open={activePanel === 'shortages'}
          disabled={shortages.length === 0}
          tone={shortages.length > 0 ? 'danger' : 'neutral'}
          onOpenChange={(open) => setPanelOpen('shortages', open)}
          compact={compact}
          className={compact ? 'w-full' : undefined}
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
      )}
      {showLoad && readiness && (
        <EmployeeLoadTile scheduleId={readiness.scheduleId} versionId={readiness.versionId} revision={readiness.revision} />
      )}
    </div>
  );
}

/** Shift-load popover trigger — usable in the stats row or the week toolbar. */
export function EmployeeLoadTile({
  scheduleId,
  versionId,
  revision,
  compact = false,
}: {
  scheduleId: string;
  versionId: string | null;
  revision: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const load = useEmployeeLoad(scheduleId, versionId, revision, open);

  return (
    <StatTile
      label="חלוקת משמרות"
      value={<span className={cn(compact ? 'text-xs font-medium' : 'text-sm font-medium')}>משמרות ושעות לעובד</span>}
      open={open}
      disabled={!versionId}
      onOpenChange={setOpen}
      panelClassName="w-[42rem]"
      compact={compact}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">חלוקת משמרות ושעות לפי עובד</p>
      {load.isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
      {load.isError && <p className="text-sm text-destructive">לא ניתן לטעון את חלוקת המשמרות.</p>}
      {load.data && <EmployeeLoadTable rows={load.data} />}
    </StatTile>
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
  compact = false,
  className,
}: {
  label: string;
  value: ReactNode;
  open: boolean;
  disabled: boolean;
  tone?: 'neutral' | 'danger';
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  panelClassName?: string;
  compact?: boolean;
  className?: string;
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
            'flex items-center justify-between gap-3 rounded-[8px] border text-start transition-colors',
            compact ? 'px-2.5 py-1.5' : 'w-full px-3 py-2',
            disabled ? 'cursor-default' : 'cursor-pointer',
            danger
              ? cn('border-red-500/40 bg-red-950/40', !disabled && 'hover:bg-red-950/60', open && 'ring-2 ring-red-400')
              : cn('border-border/60 bg-card', !disabled && 'hover:bg-muted/40', open && 'ring-2 ring-primary'),
            className,
          )}
        >
          <span className="min-w-0">
            <span className={cn('block font-semibold text-foreground', compact ? 'text-xs' : 'text-xs')}>{label}</span>
            <span className={cn('block tabular-nums', danger ? 'text-red-400' : 'text-foreground')}>{value}</span>
          </span>
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
