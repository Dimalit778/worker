import { requireSession } from '@/lib/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { Card, CardContent } from '@/components/ui/card';
import { getScheduleData } from '@/features/availability/actions';
import { ScheduleCalendar } from '@/features/availability/components/schedule-calendar';

export default async function UserSchedulePage() {
  await requireSession(SystemRole.EMPLOYEE);

  const { period, entries, isSubmitted } = await getScheduleData();

  if (!period) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">לוח משמרות</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm text-center">אין תקופת תזמון פעילה כרגע.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ScheduleCalendar period={period} initialEntries={entries} initialSubmitted={isSubmitted} />;
}
