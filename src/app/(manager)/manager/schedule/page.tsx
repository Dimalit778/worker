import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';

import { getActiveSchedule } from '@/features/schedules/assignments/queries';
import { ScheduleView } from '@/features/schedules/active-schedule/schedule-view';

export default async function ManagerActiveSchedulePage() {
  const session = await requireSession(SystemRole.MANAGER);

  if (!session.user.courtId) {
    return <div dir="rtl">המשתמש לא משויך לבית משפט.</div>;
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
      currentEmployeeId={session.user.employeeId ?? null}
      readonly={false}
    />
  );
}
