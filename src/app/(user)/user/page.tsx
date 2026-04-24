import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { getShiftsPageData } from '@/features/shifts/queries';
import { ShiftsGrid } from '@/features/shifts/components/shifts-grid';
import { Card, CardContent } from '@/components/ui/card';

export default async function UserShibutzPage() {
  const session = await requireSession(SystemRole.EMPLOYEE);

  const employee = await prisma.employee.findFirst({
    where: { user: { id: session.user.id } },
    select: { courtId: true },
  });
  const courtId = employee?.courtId ?? '';

  const data = await getShiftsPageData(courtId);
  console.log('data', data);

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

  return <ShiftsGrid {...data} readonly />;
}
