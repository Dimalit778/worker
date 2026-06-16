import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { ScheduleStatusCards } from '@/features/dashboard/components/schedule-status-cards';
import { FairnessHighlights } from '@/features/dashboard/components/fairness-highlights';
import { RecentActivity } from '@/features/dashboard/components/recent-activity';
import { StaffSummary } from '@/features/dashboard/components/staff-summary';
import { WeekCoverageCard } from '@/features/dashboard/components/week-coverage-card';
import { YearSchedulesSection } from '@/features/dashboard/components/year-schedules-section';
import { getManagerDashboardData } from '@/features/dashboard/queries';
import { parseMonthParam } from '@/features/dashboard/utils';

type ManagerDashboardPageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function ManagerDashboardPage({ searchParams }: ManagerDashboardPageProps) {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId ?? '';
  const { month } = await searchParams;
  const selection = parseMonthParam(month);

  const data = await getManagerDashboardData(courtId, selection.year);

  return (
    <div className="space-y-8" dir="rtl">
      <ScheduleStatusCards
        activeSchedule={data.activeSchedule}
        draftSchedule={data.draftSchedule}
        warnings={data.warnings}
        submissionSummary={data.submissionSummary}
      />

      <StaffSummary byPosition={data.staff.byPosition} totalActive={data.staff.totalActive} />

      {/* <FairnessHighlights items={data.fairness} /> */}

      <YearSchedulesSection yearSchedules={data.yearSchedules} initialSelection={selection} />

      {/* <RecentActivity items={data.recentActivity} /> */}
    </div>
  );
}
