import { requireSession } from '@/lib/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { prisma } from '@/lib/db/client';
import { getShibutzPageData } from '@/features/shibutz/queries';
import { ShibutzGrid } from '@/features/shibutz/components/shibutz-grid';
import { Card, CardContent } from '@/components/ui/card';

export default async function UserShibutzPage() {
  const session = await requireSession(SystemRole.EMPLOYEE);

  const employee = await prisma.employee.findFirst({
    where: { user: { id: session.user.id } },
    select: { primaryCourtId: true },
  });
  const courtId = employee?.primaryCourtId ?? '';

  const data = await getShibutzPageData(courtId);

  if (!data.found) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">שיבוץ</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">אין תקופת תזמון פעילה.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ShibutzGrid {...data} readonly />;
}
