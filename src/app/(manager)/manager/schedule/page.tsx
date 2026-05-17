import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { Schedule } from '@/features/schedules/assignments/components/schedule';
import { getCurrentSchedule } from '@/features/schedules/assignments/quries';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function ManagerSchedulePage() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId ?? '';

  const data = await getCurrentSchedule(courtId);

  if (!data.found) {
    return (
      <div className="space-y-4" dir="rtl">
        <Card size="sm" className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">שיבוץ</CardTitle>
            <CardDescription className="text-base">{data.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <header className="space-y-1 border-b border-border/50 pb-4">
        <h1 className="font-heading text-xl font-semibold tracking-tight">שיבוץ</h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/90">{data.periodName}</span>
          {' · '}
          {data.startDate} – {data.endDate}
        </p>
      </header>

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
    </div>
  );
}
