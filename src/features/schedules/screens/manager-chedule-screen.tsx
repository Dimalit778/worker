'use client';

import { useCurrentSchedule, useUpcomingSchedule } from '@/features/schedules/hooks';
import { formatDate } from '@/features/periods/utils';
import { CurrentScheduleScreen } from './current-schedule-screen';

export function ManagerScheduleScreen() {
  const { data, isLoading, isError } = useCurrentSchedule();
  const { data: upcomingData } = useUpcomingSchedule();

  return (
    <div className="space-y-8">
      <CurrentScheduleScreen
        data={data}
        isLoading={isLoading}
        isError={isError}
        loadingMessage="טוען שיבוץ נוכחי..."
        errorMessage="לא ניתן לטעון השיבוץ הנוכחי."
        emptyStateTitle="אין שיבוץ פעיל"
        isReadOnly={false}
        defaultView="weekly"
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
            isReadOnly={false}
            defaultView="weekly"
          />
        </div>
      ) : null}
    </div>
  );
}
