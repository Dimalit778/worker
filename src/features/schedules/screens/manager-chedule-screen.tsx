'use client';

import { useCurrentSchedule } from '@/features/schedules/hooks';
import { ChangeLogList } from '@/features/schedules/change-log/change-log-list';
import { CurrentScheduleScreen } from './current-schedule-screen';

export function ManagerScheduleScreen() {
  const { data, isLoading, isError } = useCurrentSchedule();

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
      />

      {data && <ChangeLogList scheduleId={data.scheduleId} versionId={data.versionId ?? null} revision={data.revision ?? 0} />}
    </div>
  );
}
