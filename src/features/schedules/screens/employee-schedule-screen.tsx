'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useEmployeeCurrentSchedule, useUpcomingSchedule } from '@/features/schedules/hooks';
import { CurrentScheduleScreen } from './current-schedule-screen';

export function EmployeeScheduleScreen({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError } = useEmployeeCurrentSchedule();
  const { data: upcoming } = useUpcomingSchedule();
  const [showUpcoming, setShowUpcoming] = useState(false);
  const isUpcomingShown = showUpcoming && !!upcoming;

  return (
    <div className="space-y-8" dir="rtl">
      {upcoming ? (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setShowUpcoming(!isUpcomingShown)}>
            {isUpcomingShown ? 'השיבוץ הנוכחי' : 'השיבוץ הבא'}
          </Button>
        </div>
      ) : null}
      <CurrentScheduleScreen
        key={isUpcomingShown ? 'upcoming' : 'current'}
        data={isUpcomingShown ? upcoming : data}
        isLoading={isUpcomingShown ? false : isLoading}
        isError={isUpcomingShown ? false : isError}
        loadingMessage="טוען שיבוץ..."
        errorMessage="לא ניתן לטעון השיבוץ."
        emptyStateTitle="אין שיבוץ פעיל"
        currentEmployeeId={employeeId}
        isReadOnly={true}
      />
    </div>
  );
}
