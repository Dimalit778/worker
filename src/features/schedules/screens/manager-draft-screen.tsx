'use client';

import { useSearchParams } from 'next/navigation';
import { CorrectionButton } from '../shared/correction-button';
import { PendingEditsProvider, usePendingEdits } from '../shared/pending-edits';
import { VersionProvider } from '../shared/version-context';
import type { CurrentScheduleData } from '../types';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreatePeriodForm } from '@/features/periods/components/create-period-form';
import { DeadlineExtension } from '@/features/periods/components/deadline-extension';
import { WeeklyDraftScheduleView } from '@/features/schedules/draft-schedule/weekly-draft-schedule-view';
import { TopBar } from '@/features/schedules/draft-schedule/topbar';
import { ScheduleStats } from '@/features/schedules/draft-schedule/schedule-stats';
import { useDraftSchedule } from '@/features/schedules/hooks';

export function ManagerDraftScreen({ scheduleId }: { scheduleId?: string }) {
  const search = useSearchParams();
  const { data, isLoading, isError } = useDraftSchedule(scheduleId ?? search.get('scheduleId') ?? undefined);

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" dir="rtl">
        טוען שיבוץ בהכנה...
      </p>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive" dir="rtl">
        לא ניתן לטעון שיבוץ בהכנה.
      </p>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4" dir="rtl">
        <Card size="sm" className="border-dashed">
          <CardHeader className="space-y-4">
            <div className="space-y-1">
              <CardTitle className="text-lg">שיבוץ בהכנה</CardTitle>
              <CardDescription className="text-base">
                לא נמצאה תקופת תזמון פתוחה לשיבוץ. צרו שיבוץ חדש כדי לאפשר לעובדים להגיש זמינות.
              </CardDescription>
            </div>
            <CreatePeriodForm triggerLabel="צור שיבוץ חדש" />
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isReadonly = data.scheduleStatus === 'PUBLISHED' && !data.hasUnpublishedDraft;
  const canCreateNewSchedule = isReadonly;
  const submission = data.availabilitySubmissionSummary;
  const eligible = submission?.eligibleEmployeeCount ?? 0;
  const submitted = submission?.submittedCount ?? 0;
  const missingEmployees = submission?.missingEmployees ?? [];

  return (
    <VersionProvider value={{ versionId: data.versionId ?? null, revision: data.revision ?? 0 }}>
      <div className="space-y-6" dir="rtl">
        <TopBar data={data} showCreateButton={canCreateNewSchedule} />
        <DeadlineExtension scheduleId={data.scheduleId} />
        <ScheduleStats
          warnings={data.warnings}
          submittedCount={submitted}
          eligibleCount={eligible}
          missingEmployees={missingEmployees}
          readiness={{ scheduleId: data.scheduleId, versionId: data.versionId ?? null, revision: data.revision ?? 0 }}
        />

        {isReadonly && (
          <div
            className="flex gap-3 rounded-2xl border border-green-200/80 bg-green-950 px-4 py-3 text-sm text-green-200 shadow-sm ring-1 ring-green-100"
            role="status"
          >
            <span className="select-none text-base leading-none" aria-hidden>
              ✓
            </span>
            <p className="leading-snug">השיבוץ פורסם ומוצג לעובדים. תיקונים יופיעו רק לאחר פרסום הטיוטה.</p>
          </div>
        )}

        {isReadonly && <CorrectionButton data={data} />}

        <PendingEditsProvider data={data}>
          <DraftSchedule data={data} readonly={isReadonly || data.scheduleStatus === 'ARCHIVED' || !data.versionId} />
        </PendingEditsProvider>
      </div>
    </VersionProvider>
  );
}

function DraftSchedule({ data, readonly }: { data: CurrentScheduleData; readonly: boolean }) {
  const assignments = usePendingEdits()?.assignments ?? data.assignments;
  return (
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
      readonly={readonly}
    />
  );
}
