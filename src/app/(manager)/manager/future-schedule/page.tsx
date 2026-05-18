import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole, type ScheduleStatus } from '@/generated/prisma/client';
import { getFutureScheduleData } from '@/features/schedules/assignments/quries';
import { Schedule } from '@/features/schedules/assignments/components/schedule';
import { DraftActions } from '@/features/schedules/components/draft-actions';
import { WarningsPanel } from '@/features/schedules/components/warnings-panel';
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
  const eligible = submission?.eligibleEmployeeCount ?? 0;
  const submitted = submission?.submittedCount ?? 0;
  const missingEmployees = submission?.missingEmployees ?? [];
  const submissionPct = eligible > 0 ? Math.min(100, Math.round((submitted / eligible) * 100)) : 0;
  const hasSchedule = data.scheduleId !== null;

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
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
              <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">הגשות זמינות</p>
                    <p className="mt-1 text-xs text-muted-foreground">עובדים פעילים שסימנו ושלחו זמינות לתקופה</p>
                  </div>
                  <p className="tabular-nums">
                    <span className="text-2xl font-semibold tracking-tight">{submitted}</span>
                    <span className="text-muted-foreground"> / {eligible}</span>
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                    style={{ width: `${submissionPct}%` }}
                    role="progressbar"
                    aria-valuenow={submissionPct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${submissionPct} אחוז מהעובדים הפעילים הגישו זמינות`}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-background px-4 py-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">לא הגישו</p>
                    <p className="mt-1 text-xs text-muted-foreground">עובדים פעילים ללא הגשת זמינות</p>
                  </div>
                  <p className="tabular-nums">
                    <span className="text-2xl font-semibold tracking-tight">{missingEmployees.length}</span>
                  </p>
                </div>
                {missingEmployees.length > 0 ? (
                  <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto pe-1 text-sm">
                    {missingEmployees.map((employee) => (
                      <li
                        key={employee.id}
                        className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-2 py-1"
                      >
                        <span className="font-medium">{employee.displayName}</span>
                        {employee.positionName && (
                          <span className="shrink-0 text-xs text-muted-foreground">{employee.positionName}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 rounded-md bg-green-50 px-2 py-2 text-sm text-green-800">
                    כל העובדים הפעילים הגישו זמינות.
                  </p>
                )}
              </div>
            </div>
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

      {hasSchedule && <WarningsPanel warnings={data.warnings} />}
    </div>
  );
}
