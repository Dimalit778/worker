import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getSchedulePageData } from '@/features/shift-assignments/queries';
import { Schedule } from '@/features/shift-assignments/components/schedule';

export default async function ManagerSchedulePage() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId ?? '';

  const data = await getSchedulePageData(courtId, { includeGuards: true });
  console.log('data', JSON.stringify(data, null, 2));

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">שיבוץ</h1>
        <p className="text-sm text-muted-foreground">אין תקופת תזמון פעילה.</p>
      </div>
    );
  }

  return <Schedule {...data} readonly={false} />;
}
