'use client';

import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { CurrentScheduleView } from '@/features/schedules/current-schedule';
import { WeeklyDraftScheduleView } from '../draft-schedule/weekly-draft-schedule-view';
import { PendingEditsProvider, usePendingEdits } from '../shared/pending-edits';
import { VersionProvider } from '../shared/version-context';
import type { CurrentScheduleData } from '../types';

const mobileQuery = '(max-width: 767px)';
const subscribeMobile = (notify: () => void) => {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};

type CurrentScheduleScreenProps = {
  data?: CurrentScheduleData | null;
  isLoading: boolean;
  isError: boolean;
  loadingMessage: string;
  errorMessage: string;
  currentEmployeeId?: string | null;
  isReadOnly?: boolean;
  emptyStateTitle?: string;
};

export function CurrentScheduleScreen({
  data,
  isLoading,
  isError,
  loadingMessage,
  errorMessage,
  currentEmployeeId = null,
  isReadOnly = true,
  emptyStateTitle = 'אין שיבוץ נוכחי',
}: CurrentScheduleScreenProps) {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" dir="rtl">
        {loadingMessage}
      </p>
    );
  }

  if (isError) {
    return (
      <div role="alert" dir="rtl" className="space-y-3">
        <p>{errorMessage}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>ניסיון טעינה מחדש</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full flex-col items-center justify-center" dir="rtl">
        <h1 className="text-2xl font-bold">{emptyStateTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">הסידור יופיע כאן לאחר פרסום</p>
      </div>
    );
  }

  return (
    <VersionProvider value={{ versionId: data.versionId ?? null, revision: data.revision ?? 0, publish: !isReadOnly }}>
      <PendingEditsProvider data={data}>
        <ScheduleContent data={data} currentEmployeeId={currentEmployeeId} isReadOnly={isReadOnly} />
      </PendingEditsProvider>
    </VersionProvider>
  );
}

function ScheduleContent({ data, currentEmployeeId, isReadOnly }: {
  data: CurrentScheduleData;
  currentEmployeeId: string | null;
  isReadOnly: boolean;
}) {
  const isMobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia(mobileQuery).matches, () => false);
  const assignments = usePendingEdits()?.assignments ?? data.assignments;

  return (
    <div className="space-y-4" dir="rtl">
      {isMobile ? (
        <CurrentScheduleView
          scheduleId={data.scheduleId}
          startDate={data.startDate}
          endDate={data.endDate}
          assignments={assignments}
          employees={data.employees}
          capacity={data.capacity}
          facilityId={data.facilityId}
          overflowCandidates={data.overflowCandidates}
          currentEmployeeId={currentEmployeeId}
          readonly={isReadOnly}
        />
      ) : (
        <WeeklyDraftScheduleView
          scheduleId={data.scheduleId}
          scheduleName={data.scheduleName}
          startDate={data.startDate}
          endDate={data.endDate}
          assignments={assignments}
          employees={data.employees}
          capacity={data.capacity}
          facilityId={data.facilityId}
          overflowCandidates={data.overflowCandidates}
          highlightedEmployeeId={currentEmployeeId}
          showHighlightPicker={!currentEmployeeId}
          readonly={isReadOnly}
        />
      )}
    </div>
  );
}
