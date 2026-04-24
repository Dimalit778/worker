'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { finalizeSchedule, publishSchedule } from '@/features/schedules/actions';
import type { ScheduleStatus } from '@/generated/prisma/client';

type Props = {
  scheduleId: string | null;
  scheduleStatus: ScheduleStatus | null;
};

const STATUS_LABELS: Record<ScheduleStatus, string> = {
  DRAFT: 'טיוטה',
  FINALIZED: 'סוכם',
  PUBLISHED: 'פורסם',
};

const STATUS_COLORS: Record<ScheduleStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  FINALIZED: 'bg-blue-100 text-blue-800 border-blue-200',
  PUBLISHED: 'bg-green-100 text-green-800 border-green-200',
};

export function DraftActions({ scheduleId, scheduleStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFinalize() {
    if (!scheduleId) return;
    setError(null);
    startTransition(async () => {
      const res = await finalizeSchedule(scheduleId);
      if ('error' in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handlePublish() {
    if (!scheduleId) return;
    setError(null);
    startTransition(async () => {
      const res = await publishSchedule(scheduleId);
      if ('error' in res) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const isPublished = scheduleStatus === 'PUBLISHED';
  const isFinalized = scheduleStatus === 'FINALIZED';
  const isDraft = scheduleStatus === 'DRAFT' || scheduleStatus === null;

  return (
    <div className="flex items-center gap-3 flex-wrap" dir="rtl">
      {scheduleStatus && (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[scheduleStatus]}`}
        >
          {STATUS_LABELS[scheduleStatus]}
        </span>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isDraft && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleFinalize}
          disabled={!scheduleId || pending}
          className="gap-1.5"
        >
          <CheckCheck className="w-4 h-4" />
          סיים עריכה
        </Button>
      )}

      <Button
        size="sm"
        variant={isPublished ? 'outline' : 'default'}
        onClick={handlePublish}
        disabled={!scheduleId || pending || isPublished}
        className="gap-1.5"
      >
        <Send className="w-4 h-4" />
        {isPublished ? 'פורסם לעובדים' : 'פרסם שיבוץ'}
      </Button>
    </div>
  );
}
