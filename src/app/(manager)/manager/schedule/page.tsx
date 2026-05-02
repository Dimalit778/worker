import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getSchedulePageData } from '@/features/schedules/queries';
import { Schedule } from '@/features/schedules/components/schedule';

export default async function ManagerSchedulePage() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId ?? '';

  const data = await getSchedulePageData(courtId, { includeEmployees: true });

  if (!data.found) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">שיבוץ</h1>
        <p className="text-sm text-muted-foreground">אין תקופת תזמון פעילה.</p>
      </div>
    );
  }

  return (
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
      readonly={false}
    />
  );
}
