'use client';

import { useEmployeeCurrentSchedule } from '@/features/schedules/hooks';
import { CurrentScheduleScreen } from './current-schedule-screen';

export function EmployeeScheduleScreen({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError } = useEmployeeCurrentSchedule();

  return (
    <CurrentScheduleScreen
      data={data}
      isLoading={isLoading}
      isError={isError}
      loadingMessage="טוען שיבוץ..."
      errorMessage="לא ניתן לטעון השיבוץ."
      currentEmployeeId={employeeId}
      isReadOnly={true}
      defaultView="daily"
    />
  );
}
