import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPeriodsForManager } from '@/features/periods/actions';
import { PeriodsList } from '@/features/periods/components/periods-list';
import { CreatePeriodForm } from '@/features/periods/components/create-period-form';
import { PeriodCalendar } from '@/features/periods/components/period-calendar';

export default async function ManagerPeriodsPage() {
  await requireSession(SystemRole.MANAGER);

  const periods = await getPeriodsForManager();

  const activeCount = periods.filter((p) => p.status === 'OPEN_FOR_SUBMISSION').length;
  const totalSubmissions = periods.reduce((sum, p) => sum + p.submittedCount, 0);
  const openPeriod = periods.find((p) => p.status === 'OPEN_FOR_SUBMISSION');

  return (
    <div className="space-y-6" dir="rtl">
      <CreatePeriodForm />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">פעילות</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">סה״כ הגשות</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalSubmissions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">תקופות סה״כ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{periods.length}</p>
          </CardContent>
        </Card>
      </div>

      {openPeriod && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              תקופה פתוחה להגשות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PeriodCalendar period={openPeriod} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">כל התקופות</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PeriodsList periods={periods} />
        </CardContent>
      </Card>
    </div>
  );
}
