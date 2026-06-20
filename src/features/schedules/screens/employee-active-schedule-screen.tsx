'use client';

import { CurrentScheduleView } from '@/features/schedules/active-schedule';
import { useEmployeeActiveSchedule } from '@/features/schedules/hooks';

export function EmployeeActiveScheduleScreen({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError } = useEmployeeActiveSchedule();

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" dir="rtl">
        טוען שיבוץ...
      </p>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive" dir="rtl">
        לא ניתן לטעון השיבוץ.
      </p>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full" dir="rtl">
        <h1 className="text-2xl font-bold">אין שיבוץ פעיל</h1>
      </div>
    );
  }

  return (
    <CurrentScheduleView
      scheduleId={data.scheduleId}
      scheduleName={data.scheduleName}
      startDate={data.startDate}
      endDate={data.endDate}
      assignments={data.assignments}
      employees={data.employees}
      capacity={data.capacity}
      courtId={data.courtId}
      overflowCandidates={data.overflowCandidates}
      currentEmployeeId={employeeId}
      readonly={true}
    />
  );
}
