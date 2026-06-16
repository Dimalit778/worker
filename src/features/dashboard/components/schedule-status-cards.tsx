import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { CreatePeriodForm } from '@/features/periods/components/create-period-form';
import { PERIOD_STATUS_HE, STATUS_BADGE } from '@/features/periods/constants';
import { formatDate } from '@/features/periods/utils';
import type { ScheduleWarningSummary } from '@/features/schedules/types';
import { cn } from '@/lib/utils';
import { AlertsSection } from './alerts-section';
import type { MissingEmployee, ScheduleSnapshot } from '../types';

type ScheduleOverviewCardProps = {
  label: string;
  schedule: ScheduleSnapshot | null;
  href: string;
  emptyText: string;
  emptyAction?: ReactNode;
  footer?: ReactNode;
};

function ScheduleOverviewCard({
  label,
  schedule,
  href,
  emptyText,
  emptyAction,
  footer,
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

  return (
    <Card size="sm" className="overflow-hidden">
      <Link
        href={href}
        className="group flex items-start gap-4 border-b border-border/60 px-5 py-4 transition-colors hover:bg-muted/30"
      >
        <div className="min-w-0 flex-1 space-y-2 text-right">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_BADGE[schedule.status])}>
              {PERIOD_STATUS_HE[schedule.status]}
            </span>
          </div>

          <p className="truncate text-base font-semibold leading-snug">{schedule.name}</p>

          <p className="text-sm text-muted-foreground">
            {formatDate(schedule.startDate)} – {formatDate(schedule.endDate)}
          </p>
        </div>

        <span
          className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-border/80 bg-muted/40 text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground"
          aria-hidden
        >
          <ChevronLeft className="size-5" />
        </span>
      </Link>

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
  warnings,
  submissionSummary,
}: ScheduleStatusCardsProps) {
  const draftAlerts =
    draftSchedule && (submissionSummary || warnings.length > 0) ? (
      <AlertsSection embedded warnings={warnings} submissionSummary={submissionSummary} />
    ) : null;

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
        />

        <ScheduleOverviewCard
          label="שיבוץ בהכנה"
          schedule={draftSchedule}
          href="/manager/draft"
          emptyText="צור שיבוץ חדש"
          emptyAction={<CreatePeriodForm triggerLabel="צור שיבוץ חדש" />}
          footer={draftAlerts}
        />
      </div>
    </section>
  );
}
