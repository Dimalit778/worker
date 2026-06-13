import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getActiveSchedule } from '@/features/schedules/assignments/queries';
import { ScheduleView } from '@/features/schedules/active-schedule/schedule-view';

export default async function EmployeeActiveSchedulePage() {
  const session = await requireSession(SystemRole.EMPLOYEE);

  if (!session.user.employeeId) {
    return <div dir="rtl">המשתמש לא משויך לעובד.</div>;
  }

  const data = await getActiveSchedule(session.user.courtId);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full" dir="rtl">
        <h1 className="text-2xl font-bold">אין שיבוץ פעיל</h1>
      </div>
    );
  }
  return (
    <ScheduleView
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
      readonly={true}
    />
  );
}
