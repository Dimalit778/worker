'use client';

import { useEmployeeCurrentSchedule } from '@/features/schedules/hooks';
import { CurrentScheduleScreen } from './current-schedule-screen';

export function EmployeeScheduleScreen({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError } = useEmployeeCurrentSchedule();

  return (
    <div className="space-y-8" dir="rtl">
      <CurrentScheduleScreen
        data={data}
        isLoading={isLoading}
        isError={isError}
        loadingMessage="טוען שיבוץ..."
        errorMessage="לא ניתן לטעון השיבוץ."
        emptyStateTitle="אין שיבוץ פעיל"
        currentEmployeeId={employeeId}
        isReadOnly={true}
      />
    </div>
  );
}
