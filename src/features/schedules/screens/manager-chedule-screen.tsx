'use client';

import { useCurrentSchedule } from '@/features/schedules/hooks';
import { CurrentScheduleScreen } from './current-schedule-screen';

export function ManagerScheduleScreen() {
  const { data, isLoading, isError } = useCurrentSchedule();

  return (
    <CurrentScheduleScreen
      data={data}
      isLoading={isLoading}
      isError={isError}
      loadingMessage="טוען שיבוץ נוכחי..."
      errorMessage="לא ניתן לטעון השיבוץ הנוכחי."
      defaultView="weekly"
    />
  );
}
