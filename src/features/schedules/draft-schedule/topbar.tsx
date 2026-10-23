import { PeriodScheduleStatus } from '@/features/schedules/period-status';
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreatePeriodForm } from '@/features/periods/components/create-period-form';
import { DeadlineExtension } from '@/features/periods/components/deadline-extension';
import { DraftActions } from './components/draft-actions';
import { Card } from '@/components/ui/card';
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
    <Card size="sm" className="rounded-[10px] shadow-sm">
      <CardHeader className="border-b border-border/50 space-y-4 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-2xl font-bold">שיבוץ בהכנה</CardTitle>
              <ScheduleStatusBadge status={data.scheduleStatus} />
            </div>
            <CardDescription className="text-[0.9375rem] font-medium text-foreground/90 leading-relaxed">
              {data.scheduleName}
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:max-w-xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              {showCreateButton && <CreatePeriodForm triggerLabel="צור שיבוץ חדש" />}
              <DraftActions
                scheduleId={data.scheduleId}
                scheduleStatus={data.scheduleStatus}
                hasUnpublishedDraft={data.hasUnpublishedDraft}
              />
            </div>
            <div className="rounded-[8px] border border-border/60 px-3 py-1.5 sm:self-end">
              <DeadlineExtension scheduleId={data.scheduleId} />
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
