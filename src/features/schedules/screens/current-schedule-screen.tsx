'use client';

import { useState } from 'react';
import { CalendarDays, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CurrentScheduleView } from '@/features/schedules/current-schedule';
import { WeeklyDraftScheduleView } from '../draft-schedule/weekly-draft-schedule-view';
import { VersionProvider } from '../shared/version-context';
import type { CurrentScheduleData } from '../types';

type ScheduleViewMode = 'weekly' | 'daily';

type CurrentScheduleScreenProps = {
  data?: CurrentScheduleData | null;
  isLoading: boolean;
  isError: boolean;
  loadingMessage: string;
  errorMessage: string;
  currentEmployeeId?: string | null;
  isReadOnly?: boolean;
  defaultView?: ScheduleViewMode;
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
  defaultView = 'daily',
  emptyStateTitle = 'אין שיבוץ נוכחי',
}: CurrentScheduleScreenProps) {
  const [viewMode, setViewMode] = useState<ScheduleViewMode>(defaultView);

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" dir="rtl">
        {loadingMessage}
      </p>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive" dir="rtl">
        {errorMessage}
      </p>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full flex-col items-center justify-center" dir="rtl">
        <h1 className="text-2xl font-bold">{emptyStateTitle}</h1>
      </div>
    );
  }

  return (
    <VersionProvider value={{ versionId: data.versionId ?? null, revision: data.revision ?? 0, publish: !isReadOnly }}>
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={viewMode === 'weekly' ? 'default' : 'outline'}
          onClick={() => setViewMode('weekly')}
          aria-pressed={viewMode === 'weekly'}
        >
          <CalendarRange className="size-4" aria-hidden />
          תצוגה שבועית
        </Button>
        <Button
          type="button"
          variant={viewMode === 'daily' ? 'default' : 'outline'}
          onClick={() => setViewMode('daily')}
          aria-pressed={viewMode === 'daily'}
        >
          <CalendarDays className="size-4" aria-hidden />
          תצוגה יומית
        </Button>
      </div>

      {viewMode === 'weekly' ? (
        <WeeklyDraftScheduleView
          scheduleId={data.scheduleId}
          scheduleName={data.scheduleName}
          startDate={data.startDate}
          endDate={data.endDate}
          assignments={data.assignments}
          employees={data.employees}
          capacity={data.capacity}
          facilityId={data.facilityId}
          overflowCandidates={data.overflowCandidates}
          highlightedEmployeeId={currentEmployeeId}
          readonly={isReadOnly}
        />
      ) : (
        <CurrentScheduleView
          scheduleId={data.scheduleId}
          scheduleName={data.scheduleName}
          startDate={data.startDate}
          endDate={data.endDate}
          assignments={data.assignments}
          employees={data.employees}
          capacity={data.capacity}
          facilityId={data.facilityId}
          overflowCandidates={data.overflowCandidates}
          currentEmployeeId={currentEmployeeId}
          readonly={isReadOnly}
        />
      )}
    </div>
    </VersionProvider>
  );
}
