import { requireSession } from '@/lib/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getShiftsPageData } from '@/features/shifts/queries';
import { ShiftsGrid } from '@/features/shifts/components/shifts-grid';

export default async function ManagerShiftsPage() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.primaryCourtId ?? '';

  const data = await getShiftsPageData(courtId, { includeGuards: true });

  if (!data.found) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">שיבוץ</h1>
        <p className="text-sm text-muted-foreground">אין תקופת תזמון פעילה.</p>
      </div>
    );
  }

  return <ShiftsGrid {...data} />;
}
