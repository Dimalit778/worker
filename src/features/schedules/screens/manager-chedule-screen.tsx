'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchOriginalSchedule } from '../assignments/actions';
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

      {data && <OriginalSchedule key={data.scheduleId} scheduleId={data.scheduleId} />}
      {data && <ChangeLogList scheduleId={data.scheduleId} versionId={data.versionId ?? null} revision={data.revision ?? 0} />}
    </div>
  );
}

function OriginalSchedule({ scheduleId }: { scheduleId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['schedules', 'original', scheduleId],
    queryFn: () => fetchOriginalSchedule(scheduleId), enabled: open,
  });
  return (
    <details className="rounded-lg border bg-card p-4" dir="rtl" onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-medium">השיבוץ המקורי כפי שפורסם לראשונה</summary>
      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">עותק קבוע לצפייה בלבד. השינויים המאוחרים מופיעים בשיבוץ הנוכחי ובהיסטוריה.</p>
          <CurrentScheduleScreen key={data?.versionId ?? 'loading'} data={data} isLoading={isLoading} isError={isError}
            loadingMessage="טוען שיבוץ מקורי..." errorMessage="לא ניתן לטעון את השיבוץ המקורי."
            emptyStateTitle="לא נמצא עותק מקור" isReadOnly />
        </div>
      )}
    </details>
  );
}
