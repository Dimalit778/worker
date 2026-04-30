'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCheck, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { finalizeSchedule, publishSchedule } from '@/features/schedules/actions';
import { generateAutoSchedule } from '@/features/schedules/generate-action';
import type { ScheduleStatus } from '@/generated/prisma/client';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';

type Props = {
  periodId: string;
  scheduleId: string | null;
  scheduleStatus: ScheduleStatus | null;
};

export function DraftActions({ periodId, scheduleId, scheduleStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<'generate' | 'finalize' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    setMessage(null);
    setPendingAction('generate');
    startTransition(async () => {
      try {
        const res = await generateAutoSchedule(periodId);
        if ('error' in res) {
          setError(res.error);
          return;
        }
        setMessage('השיבוץ האוטומטי נוצר בהצלחה');
        router.refresh();
      } catch {
        setError('שגיאה ביצירת שיבוץ אוטומטי');
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleFinalize() {
    if (!scheduleId) return;
    setError(null);
    setMessage(null);
    setPendingAction('finalize');
    startTransition(async () => {
      try {
        const res = await finalizeSchedule(scheduleId);
        if ('error' in res) {
          setError(res.error);
          return;
        }
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handlePublish() {
    if (!scheduleId) return;
    setError(null);
    setMessage(null);
    setPendingAction('publish');
    startTransition(async () => {
      try {
        const res = await publishSchedule(scheduleId);
        if ('error' in res) {
          setError(res.error);
          return;
        }
        router.refresh();
      } finally {
        setPendingAction(null);
      }
    });
  }

  const isPublished = scheduleStatus === 'PUBLISHED';
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
      {message && <p className="text-sm text-green-700">{message}</p>}

      {isDraft && (
        <Button size="sm" variant="default" onClick={handleGenerate} disabled={pending} className="gap-1.5">
          <Sparkles className="w-4 h-4" />
          {pendingAction === 'generate' ? 'יוצר שיבוץ...' : 'צור שיבוץ אוטומטי'}
        </Button>
      )}

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
