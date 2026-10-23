'use client';
import { useState, type ReactNode } from 'react';
import { ChartNoAxesColumn, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, Popover } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { EmployeeWarningsPanel } from '@/features/schedules/warnings/components/warnings-panel';
import { groupWarningsByEmployee } from '@/features/schedules/warnings/utils';
import type { ScheduleWarningSummary } from '@/features/schedules/types';
import { SHIFT_LABELS, WEEKDAY_HEADER_LETTERS } from '@/features/schedules/constants';
import { useEmployeeLoad, useSubmissionReadiness } from '@/features/schedules/readiness/hooks';
import { SubmissionStatusList } from '@/features/schedules/readiness/components/submission-status-list';
import { EmployeeLoadList } from '@/features/schedules/readiness/components/employee-load-table';

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
  /** `inline` = one segmented strip for the week toolbar; `grid` = full-width cards. */
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
  const valueClass = compact ? 'text-base font-bold leading-tight tracking-tight' : 'text-2xl font-bold tracking-tight';
  const mutedClass = 'text-sm text-muted-foreground';

  function setPanelOpen(panel: Exclude<ActivePanel, null>, open: boolean) {
    setActivePanel((prev) => (open ? panel : prev === panel ? null : prev));
  }

  const activeGroups = activePanel === 'errors' ? groupWarningsByEmployee(employeeWarnings) : [];

  return (
    <div
      className={cn(
        compact
          ? 'flex w-full items-stretch divide-x divide-border/60 overflow-hidden rounded-md border border-border bg-card shadow-[var(--glass-shadow)]'
          : cn('grid grid-cols-2 items-start gap-3', tileCount >= 4 && 'sm:grid-cols-4', tileCount === 3 && 'sm:grid-cols-3'),
      )}
      dir="rtl"
    >
      <StatTile
        label="הגשות"
        title="הגשות זמינות"
        count={`${shownSubmitted}/${shownEligible}`}
        value={
          <>
            <span className={valueClass}>{shownSubmitted}</span>
            <span className={mutedClass}> / {shownEligible}</span>
          </>
        }
        progress={shownEligible > 0 ? shownSubmitted / shownEligible : undefined}
        open={activePanel === 'submissions'}
        disabled={readiness ? shownEligible === 0 : !hasPendingSubmissions}
        onOpenChange={(open) => setPanelOpen('submissions', open)}
        panelClassName="w-[26rem]"
        compact={compact}
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
        title="בעיות לפי עובד"
        count={issueCount}
        value={<span className={valueClass}>{hasSchedule ? issueCount : '—'}</span>}
        open={activePanel === 'errors'}
        disabled={issueCount === 0}
        tone={issueCount > 0 ? 'danger' : 'neutral'}
        onOpenChange={(open) => setPanelOpen('errors', open)}
        compact={compact}
      >
        <EmployeeWarningsPanel groups={activeGroups} compact />
      </StatTile>
      {showShortages && (
        <StatTile
          label="חוסר"
          title="חוסר לפי תקני חובה"
          count={shortages.length}
          value={<span className={valueClass}>{hasSchedule ? shortages.length : '—'}</span>}
          open={activePanel === 'shortages'}
          disabled={shortages.length === 0}
          tone={shortages.length > 0 ? 'danger' : 'neutral'}
          onOpenChange={(open) => setPanelOpen('shortages', open)}
          compact={compact}
        >
          <ShortageList shortages={shortages} />
        </StatTile>
      )}
      {showLoad && readiness && (
        <EmployeeLoadTile scheduleId={readiness.scheduleId} versionId={readiness.versionId} revision={readiness.revision} />
      )}
    </div>
  );
}

function formatDayHeader(date: string) {
  const weekday = WEEKDAY_HEADER_LETTERS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${weekday}׳ · ${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** Mandatory-staffing shortages grouped by day. */
function ShortageList({ shortages }: { shortages: ScheduleWarningSummary[] }) {
  const groups = new Map<string, ScheduleWarningSummary[]>();
  for (const warning of shortages) {
    const key = warning.date?.slice(0, 10) ?? '';
    groups.set(key, [...(groups.get(key) ?? []), warning]);
  }
  const days = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));

  return (
    <div className="space-y-3">
      {days.map((day) => (
        <section key={day || 'none'}>
          <h3 className="mb-1 px-1 text-xs font-semibold tabular-nums text-muted-foreground">
            {day ? formatDayHeader(day) : 'ללא תאריך'}
          </h3>
          <ul className="divide-y divide-border/50 rounded-lg bg-muted/30">
            {groups.get(day)!.map((w) => (
              <li key={w.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <span className="size-1.5 shrink-0 rounded-full bg-red-400" aria-hidden />
                <span className="font-medium">
                  {[w.shiftType ? SHIFT_LABELS[w.shiftType] : null, w.positionName].filter(Boolean).join(' · ') || w.message}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Opens the per-employee shift distribution in a side drawer that keeps the schedule usable. */
export function EmployeeLoadTile({
  scheduleId,
  versionId,
  revision,
  highlightedEmployeeId = null,
  onHighlightEmployee,
}: {
  scheduleId: string;
  versionId: string | null;
  revision: number;
  highlightedEmployeeId?: string | null;
  onHighlightEmployee?: (employeeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const load = useEmployeeLoad(scheduleId, versionId, revision, open);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
      <Dialog.Trigger asChild>
        <Button
          variant="outline"
          disabled={!versionId}
          className="h-9 gap-2 rounded-md border-border bg-card shadow-[var(--glass-shadow)]"
        >
          <ChartNoAxesColumn className="size-4" aria-hidden />
          חלוקת משמרות
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          dir="rtl"
          onInteractOutside={(event) => event.preventDefault()}
          className="fixed inset-y-0 inset-e-0 z-[110] flex w-full max-w-sm flex-col border-s border-border bg-popover text-popover-foreground shadow-xl outline-none duration-200 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold">חלוקת משמרות</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                {onHighlightEmployee ? 'לחיצה על עובד מסמנת את המשמרות שלו בלוח' : 'משמרות ושעות לפי עובד'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="סגירה">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {load.isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}
            {load.isError && <p className="text-sm text-destructive">לא ניתן לטעון את חלוקת המשמרות.</p>}
            {load.data && (
              <EmployeeLoadList
                rows={load.data}
                highlightedEmployeeId={highlightedEmployeeId}
                onSelect={onHighlightEmployee}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StatTile({
  label,
  title,
  count,
  value,
  progress,
  open,
  disabled,
  tone = 'neutral',
  onOpenChange,
  children,
  panelClassName,
  compact = false,
}: {
  label: string;
  title: string;
  count: ReactNode;
  value: ReactNode;
  /** 0–1; drawn as a hairline bar under the value in the compact strip. */
  progress?: number;
  open: boolean;
  disabled: boolean;
  tone?: 'neutral' | 'danger';
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  panelClassName?: string;
  compact?: boolean;
}) {
  const danger = tone === 'danger';
  const isOpen = !disabled && open;

  return (
    <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        {compact ? (
          <button
            type="button"
            disabled={disabled}
            aria-expanded={isOpen}
            className={cn(
              'flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-1 text-start outline-none transition-colors focus-visible:bg-muted/60',
              disabled ? 'cursor-default' : 'cursor-pointer hover:bg-muted/40',
              isOpen && 'bg-muted/60',
            )}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {danger && <span className="size-1.5 shrink-0 rounded-full bg-red-400" aria-hidden />}
              {label}
              {!disabled && (
                <ChevronDown
                  className={cn('ms-auto size-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')}
                  aria-hidden
                />
              )}
            </span>
            <span className={cn('block tabular-nums', danger ? 'text-red-400' : 'text-foreground')}>{value}</span>
            {progress !== undefined && (
              <span className="mt-0.5 block h-0.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                <span
                  className={cn('block h-full rounded-full', progress >= 1 ? 'bg-emerald-400' : 'bg-primary')}
                  style={{ width: `${Math.min(progress, 1) * 100}%` }}
                />
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            aria-expanded={isOpen}
            className={cn(
              'flex w-full items-center justify-between gap-3 rounded-[8px] border px-3 py-2 text-start transition-colors',
              disabled ? 'cursor-default' : 'cursor-pointer',
              danger
                ? cn('border-red-500/40 bg-red-950/40', !disabled && 'hover:bg-red-950/60', open && 'ring-2 ring-red-400')
                : cn('border-border/60 bg-card', !disabled && 'hover:bg-muted/40', open && 'ring-2 ring-primary'),
            )}
          >
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-foreground">{label}</span>
              <span className={cn('block tabular-nums', danger ? 'text-red-400' : 'text-foreground')}>{value}</span>
            </span>
          </button>
        )}
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
            'z-50 flex w-[22.5rem] max-w-[calc(100vw-24px)] max-h-[min(28rem,var(--radix-popover-content-available-height))] flex-col overflow-hidden rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-lg outline-none',
            panelClassName,
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 ps-4 pe-2">
            <p className="flex items-center gap-2 text-sm font-semibold">
              {title}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {count}
              </span>
            </p>
            <Popover.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="סגירה">
                <X />
              </Button>
            </Popover.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
