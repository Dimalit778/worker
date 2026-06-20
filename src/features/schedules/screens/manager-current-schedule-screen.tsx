'use client';

import { CurrentScheduleView } from '@/features/schedules/current-schedule';
import { useCurrentSchedule } from '@/features/schedules/hooks';

type ManagerCurrentScheduleScreenProps = {
  currentEmployeeId?: string | null;
};

export function ManagerCurrentScheduleScreen({ currentEmployeeId = null }: ManagerCurrentScheduleScreenProps) {
  const { data, isLoading, isError } = useCurrentSchedule();

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" dir="rtl">
        טוען שיבוץ נוכחי...
      </p>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive" dir="rtl">
        לא ניתן לטעון השיבוץ הנוכחי.
      </p>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full" dir="rtl">
        <h1 className="text-2xl font-bold">אין שיבוץ נוכחי</h1>
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
      readonly={true}
    />
  );
}
