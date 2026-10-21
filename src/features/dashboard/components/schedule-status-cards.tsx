import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { CreatePeriodForm } from '@/features/periods/components/create-period-form';
import { PERIOD_STATUS_HE, STATUS_BADGE } from '@/features/periods/constants';
import { formatDate } from '@/features/periods/utils';
import type { ScheduleWarningSummary } from '@/features/schedules/types';
import { cn } from '@/lib/utils';
import type { MissingEmployee, ScheduleSnapshot } from '../types';

// Dashboard wording for the submission window of a schedule in preparation.
const CARD_STATUS_HE: Partial<Record<ScheduleSnapshot['status'], string>> = {
  DRAFT: 'ממתין לשליחה',
  OPEN: 'נשלח',
  LOCKED: 'נסגר',
};

type ScheduleOverviewCardProps = {
  label: string;
  schedule: ScheduleSnapshot | null;
  href?: string;
  emptyText: string;
  emptyAction?: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
  /** Status badge (e.g. פורסם) — useful on draft, noise on the live schedule. */
  showStatus?: boolean;
  /** Slightly stronger treatment for the live/current schedule card. */
  emphasize?: boolean;
};

function ScheduleOverviewCard({
  label,
  schedule,
  href,
  emptyText,
  emptyAction,
  footer,
  aside,
  showStatus = true,
  emphasize = false,
}: ScheduleOverviewCardProps) {
  if (!schedule) {
    return (
      <Card size="sm" className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
          {emptyAction}
        </div>
      </Card>
    );
  }

  const content = (
    <>
      <div className="min-w-0 flex-1 space-y-2 text-right">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              'text-xs font-medium',
              emphasize ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {label}
          </p>
          {showStatus && (
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_BADGE[schedule.status])}>
              {CARD_STATUS_HE[schedule.status] ?? PERIOD_STATUS_HE[schedule.status]}
            </span>
          )}
        </div>

        <p
          className={cn(
            'truncate leading-snug',
            emphasize ? 'text-lg font-semibold text-foreground' : 'text-base font-semibold',
          )}
        >
          {schedule.name}
        </p>

        <p className="text-sm text-muted-foreground">
          {formatDate(schedule.startDate)} – {formatDate(schedule.endDate)}
        </p>
      </div>

      {aside ?? (
        <span
          className={cn(
            'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors',
            emphasize
              ? 'border-primary/30 bg-primary/10 text-primary group-hover:bg-primary/15'
              : 'border-border/80 bg-muted/40 text-muted-foreground group-hover:bg-muted group-hover:text-foreground',
          )}
          aria-hidden
        >
          <ChevronLeft className="size-5" />
        </span>
      )}
    </>
  );
  const rowClassName = 'group flex items-start gap-4 border-b border-border/60 px-5 py-4';

  return (
    <Card
      size="sm"
      className={cn(
        'overflow-hidden',
        emphasize && 'ring-1 ring-primary/25 bg-primary/[0.04]',
      )}
    >
      {/* Without a link target the card is informational only (e.g. draft still open for submissions). */}
      {href ? (
        <Link
          href={href}
          className={cn(
            rowClassName,
            'transition-colors',
            emphasize ? 'hover:bg-primary/[0.06]' : 'hover:bg-muted/30',
          )}
        >
          {content}
        </Link>
      ) : (
        <div className={rowClassName}>{content}</div>
      )}

      {footer && <div className="px-5 py-4">{footer}</div>}
    </Card>
  );
}

type ScheduleStatusCardsProps = {
  activeSchedule: ScheduleSnapshot | null;
  draftSchedule: ScheduleSnapshot | null;
  warnings: ScheduleWarningSummary[];
  submissionSummary: {
    submittedCount: number;
    eligibleCount: number;
    missingEmployees: MissingEmployee[];
  } | null;
};

export function ScheduleStatusCards({
  activeSchedule,
  draftSchedule,
  submissionSummary,
}: ScheduleStatusCardsProps) {
  // The draft screen is reachable only once the submission deadline has passed.
  const draftDeadlinePassed =
    !draftSchedule?.submissionDeadline || new Date(draftSchedule.submissionDeadline) <= new Date();

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">מצב שיבוצים</h2>
        <p className="text-sm text-muted-foreground">השיבוץ הנוכחי והשיבוץ בהכנה</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ScheduleOverviewCard
          label="שיבוץ נוכחי"
          schedule={activeSchedule}
          href="/manager/schedule"
          emptyText="אין שיבוץ פעיל כרגע."
          showStatus={false}
          emphasize
        />

        <ScheduleOverviewCard
          label="שיבוץ בהכנה"
          schedule={draftSchedule}
          href={draftDeadlinePassed && draftSchedule ? `/manager/draft?scheduleId=${encodeURIComponent(draftSchedule.id)}` : undefined}
          emptyText="אין שיבוץ שההגשות עבורו נסגרו."
          emptyAction={<CreatePeriodForm triggerLabel="צור שיבוץ חדש" />}
          aside={
            submissionSummary ? (
              <span className="shrink-0 text-end">
                <span className="block text-xs font-medium text-muted-foreground">הגשות</span>
                <span className="mt-1 block tabular-nums text-foreground">
                  <span className="text-2xl font-bold tracking-tight">{submissionSummary.submittedCount}</span>
                  <span className="text-sm text-muted-foreground"> / {submissionSummary.eligibleCount}</span>
                </span>
              </span>
            ) : undefined
          }
        />
      </div>
    </section>
  );
}
