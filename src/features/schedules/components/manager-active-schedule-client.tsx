'use client';

import { CurrentScheduleView } from '@/features/schedules/current-schudle';
import { useActiveSchedule } from '@/features/schedules/hooks';

type ManagerActiveScheduleClientProps = {
  currentEmployeeId?: string | null;
};

export function ManagerActiveScheduleClient({ currentEmployeeId = null }: ManagerActiveScheduleClientProps) {
  const { data, isLoading, isError } = useActiveSchedule();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground" dir="rtl">טוען שיבוץ פעיל...</p>;
  }

  if (isError) {
    return <p className="text-sm text-destructive" dir="rtl">לא ניתן לטעון השיבוץ הפעיל.</p>;
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
      currentEmployeeId={currentEmployeeId}
      readonly={false}
    />
  );
}
