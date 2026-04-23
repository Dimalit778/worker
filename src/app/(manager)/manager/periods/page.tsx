import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPeriodsForManager } from '@/features/schedules/period-actions';
import { PeriodsList } from '@/features/schedules/components/periods-list';
import { CreatePeriodForm } from '@/features/schedules/components/create-period-form';

export default async function ManagerPeriodsPage() {
  await requireSession(SystemRole.MANAGER);

  const periods = await getPeriodsForManager();

  const activeCount = periods.filter((p) => p.status === 'OPEN_FOR_SUBMISSION').length;

  const totalSubmissions = periods.reduce((sum, p) => sum + p.submittedCount, 0);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">תקופות שיבוץ</h1>
        <CreatePeriodForm />
      </div>

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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">כל התקופות</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <PeriodsList periods={periods} />
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">זרימת העבודה</p>
        <ol className="list-decimal list-inside space-y-1 text-xs">
          <li>צור תקופה חדשה — היא נפתחת אוטומטית להגשות.</li>
          <li>המאבטחים רואים אותה בלוח המשמרות שלהם ומגישים זמינות.</li>
          <li>
            לחץ <strong>נעל</strong> לסגירת ההגשות.
          </li>
          <li>
            עבור לדף <strong>שיבוץ</strong> לביצוע השיבוץ הסופי.
          </li>
        </ol>
      </div>
    </div>
  );
}
