'use client';
import { Button } from '@/components/ui/button';

import { ScheduleStatusCards } from '@/features/dashboard/components/schedule-status-cards';
import { StaffSummary } from '@/features/dashboard/components/staff-summary';
import { YearSchedulesSection } from '@/features/dashboard/components/year-schedules-section';
import { useManagerDashboard } from '@/features/dashboard/hooks';
import type { MonthSelection } from '@/features/dashboard/utils';

type ManagerDashboardProps = {
  year: number;
  initialSelection: MonthSelection;
};

export function ManagerDashboard({ year, initialSelection }: ManagerDashboardProps) {
  const { data, isLoading, isError, refetch } = useManagerDashboard(year);

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" dir="rtl">
        טוען לוח מנהל...
      </p>
    );
  }

  if (isError || !data) {
    return (
      <div role="alert" dir="rtl"><p>לא ניתן לטעון נתוני הלוח.</p><Button variant="outline" onClick={() => void refetch()}>ניסיון טעינה מחדש</Button></div>
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
        <YearSchedulesSection yearSchedules={data.yearSchedules} initialSelection={initialSelection} />
        <StaffSummary byPosition={data.staff.byPosition} totalActive={data.staff.totalActive} />
      </div>
    </div>
  );
}
