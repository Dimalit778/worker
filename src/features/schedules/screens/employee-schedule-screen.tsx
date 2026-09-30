'use client';

import { useEmployeeCurrentSchedule, useUpcomingSchedule } from '@/features/schedules/hooks';
import { formatDate } from '@/features/periods/utils';
import { CurrentScheduleScreen } from './current-schedule-screen';

export function EmployeeScheduleScreen({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError } = useEmployeeCurrentSchedule();
  const { data: upcomingData } = useUpcomingSchedule();

  return (
    <div className="space-y-8">
      <CurrentScheduleScreen
        data={data}
        isLoading={isLoading}
        isError={isError}
        loadingMessage="טוען שיבוץ..."
        errorMessage="לא ניתן לטעון השיבוץ."
        emptyStateTitle="אין שיבוץ פעיל"
        currentEmployeeId={employeeId}
        isReadOnly={true}
        defaultView="daily"
      />

      {upcomingData ? (
        <div className="space-y-4" dir="rtl">
          <h2 className="text-xl font-bold">
            השיבוץ הבא ({formatDate(upcomingData.startDate)} - {formatDate(upcomingData.endDate)})
          </h2>
          <CurrentScheduleScreen
            data={upcomingData}
            isLoading={false}
            isError={false}
            loadingMessage=""
            errorMessage=""
            currentEmployeeId={employeeId}
            isReadOnly={true}
            defaultView="daily"
          />
        </div>
      ) : null}
    </div>
  );
}
