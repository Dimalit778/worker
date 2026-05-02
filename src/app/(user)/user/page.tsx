import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { getSchedulePageData } from '@/features/schedules/queries';
import { Schedule } from '@/features/schedules/components/schedule';
import { Card, CardContent } from '@/components/ui/card';

export default async function UserShibutzPage() {
  const session = await requireSession(SystemRole.EMPLOYEE);

  const data = await getSchedulePageData(session.user.courtId ?? '');

  if (!data.found) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">אין תקופת תזמון פעילה.</p>
          </CardContent>
        </Card>
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
      readonly
    />
  );
}
