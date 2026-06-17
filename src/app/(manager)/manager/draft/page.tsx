import { requireSession } from '@/lib/db/auth-helpers';
import { ScheduleStatus, SystemRole } from '@/generated/prisma/client';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDraftScheduleData } from '@/features/schedules/assignments/queries';
import { CreatePeriodForm } from '@/features/periods/components/create-period-form';
import { TopBar } from '@/features/schedules/draft-schedule/topbar';
import { ScheduleStats } from '@/features/schedules/draft-schedule/schedule-stats';
import { ScheduleView } from '@/features/schedules/active-schedule/schedule-view';

export default async function ManagerDraftSchedulePage() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId ?? '';

  const data = await getDraftScheduleData(courtId);

  if (!data) {
    return (
      <div className="space-y-4" dir="rtl">
        <Card size="sm" className="border-dashed">
          <CardHeader className="space-y-4">
            <div className="space-y-1">
              <CardTitle className="text-lg">שיבוץ בהכנה</CardTitle>
              <CardDescription className="text-base">
                לא נמצאה תקופת תזמון פתוחה לשיבוץ. צרו שיבוץ חדש כדי לאפשר לעובדים להגיש זמינות.
              </CardDescription>
            </div>
            <CreatePeriodForm triggerLabel="צור שיבוץ חדש" />
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isReadonly = data.scheduleStatus === ScheduleStatus.ACTIVE;
  const canCreateNewSchedule = isReadonly;
  const submission = data.availabilitySubmissionSummary;
  const eligible = submission?.eligibleEmployeeCount ?? 0;
  const submitted = submission?.submittedCount ?? 0;
  const missingEmployees = submission?.missingEmployees ?? [];

  return (
    <div className="space-y-6" dir="rtl">
      <TopBar data={data} showCreateButton={canCreateNewSchedule} />
      <ScheduleStats
        warnings={data.warnings}
        submittedCount={submitted}
        eligibleCount={eligible}
        missingEmployees={missingEmployees}
      />

      {isReadonly && (
        <div
          className="flex gap-3 rounded-2xl border border-green-200/80 bg-green-50 px-4 py-3 text-sm text-green-900 shadow-sm ring-1 ring-green-100"
          role="status"
        >
          <span className="select-none text-base leading-none" aria-hidden>
            ✓
          </span>
          <p className="leading-snug">השיבוץ פורסם ומוצג לכלל העובדים. לעריכה נוספת יש לפנות להגדרות.</p>
        </div>
      )}

      <ScheduleView
        scheduleId={data.scheduleId}
        scheduleName={data.scheduleName}
        startDate={data.startDate}
        endDate={data.endDate}
        scheduleStatus={data.scheduleStatus}
        assignments={data.assignments}
        employees={data.employees}
        capacity={data.capacity}
        courtId={data.courtId}
        overflowCandidates={data.overflowCandidates}
        readonly={isReadonly}
        viewMode="table"
      />
    </div>
  );
}
