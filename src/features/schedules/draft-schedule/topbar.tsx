import { PeriodScheduleStatus } from '@/features/schedules/period-status';
import { CreatePeriodForm } from '@/features/periods/components/create-period-form';
import { DeadlineExtension } from '@/features/periods/components/deadline-extension';
import { DraftActions } from './components/draft-actions';
import type { CurrentScheduleData } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import { cn } from '@/lib/utils';

function ScheduleStatusBadge({ status }: { status: PeriodScheduleStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex rounded-md border border-dashed border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
        אין לוח שיבוץ
      </span>
    );
  }
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function TopBar({ data, showCreateButton = false }: { data: CurrentScheduleData; showCreateButton?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h1 className="font-heading text-xl font-bold leading-tight tracking-tight text-foreground">שיבוץ בהכנה</h1>
          <ScheduleStatusBadge status={data.scheduleStatus} />
        </div>
        {/* Period facts on one quiet line; the dot separator only appears between items that render. */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 [&>*:not(:first-child)]:before:me-2 [&>*:not(:first-child)]:before:text-muted-foreground/50 [&>*:not(:first-child)]:before:content-['·']">
          <span className="text-sm font-medium tabular-nums text-foreground/85">{data.scheduleName}</span>
          <DeadlineExtension scheduleId={data.scheduleId} allowExtend={false} />
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end" dir="rtl">
        {showCreateButton && <CreatePeriodForm triggerLabel="צור שיבוץ חדש" />}
        <DraftActions
          scheduleId={data.scheduleId}
          scheduleStatus={data.scheduleStatus}
          hasUnpublishedDraft={data.hasUnpublishedDraft}
        />
      </div>
    </div>
  );
}
