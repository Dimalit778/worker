import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole, type ScheduleStatus } from '@/generated/prisma/client';
import { getFutureScheduleData } from '@/features/schedules/assignments/quries';
import { Schedule } from '@/features/schedules/assignments/components/schedule';
import { DraftActions } from '@/features/schedules/components/draft-actions';
import { ScheduleSummaryBar } from '@/features/schedules/components/schedule-summary-bar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { STATUS_COLORS, STATUS_LABELS } from '@/features/schedules/constants';
import { cn } from '@/lib/utils';

function ScheduleStatusBadge({ status }: { status: ScheduleStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex rounded-md border border-dashed border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
        אין לוח שיבוץ
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-2 py-0.5 text-xs font-medium',
        STATUS_COLORS[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default async function FutureSchedulePage() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId ?? '';

  const data = await getFutureScheduleData(courtId);

  if (!data.found) {
    return (
      <div className="space-y-4" dir="rtl">
        <Card size="sm" className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">שיבוץ בהכנה</CardTitle>
            <CardDescription className="text-base">{data.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isReadonly = data.scheduleStatus === 'PUBLISHED';
  const submission = data.availabilitySubmissionSummary;

  return (
    <div className="space-y-6" dir="rtl">
      <Card size="sm" className="shadow-sm">
        <CardHeader className="border-b border-border/50 space-y-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl font-semibold">שיבוץ בהכנה</CardTitle>
                <ScheduleStatusBadge status={data.scheduleStatus} />
              </div>
              <CardDescription className="text-[0.9375rem] leading-relaxed">
                <span className="font-medium text-foreground/90">{data.periodName}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {data.startDate} – {data.endDate}
                </span>
              </CardDescription>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <DraftActions
                periodId={data.periodId}
                scheduleId={data.scheduleId}
                scheduleStatus={data.scheduleStatus}
              />
            </div>
          </div>
        </CardHeader>

        {submission !== undefined && (
          <CardContent className="pt-4">
            <ScheduleSummaryBar
              warnings={data.warnings}
              submittedCount={submission.submittedCount}
              eligibleCount={submission.eligibleEmployeeCount}
            />
          </CardContent>
        )}
      </Card>

      {isReadonly && (
        <div
          className="flex gap-3 rounded-2xl border border-green-200/80 bg-green-50 px-4 py-3 text-sm text-green-900 shadow-sm ring-1 ring-green-100"
          role="status"
        >
          <span className="select-none text-base leading-none" aria-hidden>
            ✓
          </span>
          <p className="leading-snug">
            השיבוץ פורסם ומוצג לכלל העובדים. לעריכה נוספת יש לפנות להגדרות.
          </p>
        </div>
      )}

      <Schedule
        periodId={data.periodId}
        periodName={data.periodName}
        startDate={data.startDate}
        endDate={data.endDate}
        scheduleId={data.scheduleId}
        scheduleStatus={data.scheduleStatus}
        assignments={data.assignments}
        employees={data.employees}
        capacity={data.capacity}
        courtId={data.courtId}
        overflowCandidates={data.overflowCandidates}
        readonly={isReadonly}
      />
    </div>
  );
}
