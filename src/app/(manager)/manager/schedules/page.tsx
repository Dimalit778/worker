import { requireSession } from '@/lib/db/auth-helpers';
import { ScheduleStatus, SystemRole } from '@/generated/prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSchedulesList } from '@/features/periods/actions';
import { SchedulesList } from '@/features/periods/components/periods-list';
import { CreatePeriodForm } from '@/features/periods/components/create-period-form';
import { PeriodCalendar } from '@/features/periods/components/period-calendar';
import ScheduleInformation from '@/features/schedules/draft-schedule/schedule-information';

export default async function SchedulesListPage() {
  await requireSession(SystemRole.MANAGER);

  const schedules = await getSchedulesList();

  const activeCount = schedules.filter((p) => p.status === ScheduleStatus.OPEN_FOR_SUBMISSION).length;
  const totalSubmissions = schedules.reduce((sum, p) => sum + p.submittedCount, 0);
  const openPeriod = schedules.find((p) => p.status === ScheduleStatus.OPEN_FOR_SUBMISSION);

  return (
    <div className="space-y-6" dir="rtl">
      <CreatePeriodForm />

      <ScheduleInformation activeCount={activeCount} totalSubmissions={totalSubmissions} schedules={schedules} />

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
          <SchedulesList schedules={schedules} />
        </CardContent>
      </Card>
    </div>
  );
}
