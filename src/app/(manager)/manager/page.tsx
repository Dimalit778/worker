import { ScheduleStatusCards } from '@/features/dashboard/components/schedule-status-cards';
import { StaffSummary } from '@/features/dashboard/components/staff-summary';

import { YearSchedulesSection } from '@/features/dashboard/components/year-schedules-section';
import { getManagerDashboardData } from '@/features/dashboard/queries';
import { parseMonthParam } from '@/features/dashboard/utils';

type ManagerDashboardPageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function ManagerDashboardPage({ searchParams }: ManagerDashboardPageProps) {
  const { month } = await searchParams;
  const selection = parseMonthParam(month);

  const data = await getManagerDashboardData(selection.year);

  return (
    <div className="space-y-8" dir="rtl">
      <ScheduleStatusCards
        activeSchedule={data.activeSchedule}
        draftSchedule={data.draftSchedule}
        warnings={data.warnings}
        submissionSummary={data.submissionSummary}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <StaffSummary byPosition={data.staff.byPosition} totalActive={data.staff.totalActive} />

        <YearSchedulesSection yearSchedules={data.yearSchedules} initialSelection={selection} />
      </div>
    </div>
  );
}
