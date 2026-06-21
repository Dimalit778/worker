'use client';

import { ScheduleStatusCards } from '@/features/dashboard/components/schedule-status-cards';
import { StaffSummary } from '@/features/dashboard/components/staff-summary';
import { YearSchedulesSection } from '@/features/dashboard/components/year-schedules-section';
import { useManagerDashboard } from '@/features/dashboard/hooks';
import type { MonthSelection } from '@/features/dashboard/utils';

type ManagerDashboardClientProps = {
  year: number;
  initialSelection: MonthSelection;
};

export function ManagerDashboardClient({ year, initialSelection }: ManagerDashboardClientProps) {
  const { data, isLoading, isError } = useManagerDashboard(year);
  console.log(JSON.stringify(data, null, 2));

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" dir="rtl">
        טוען לוח מנהל...
      </p>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive" dir="rtl">
        לא ניתן לטעון נתוני הלוח.
      </p>
    );
  }

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
        <YearSchedulesSection yearSchedules={data.yearSchedules} initialSelection={initialSelection} />
      </div>
    </div>
  );
}
