'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateAutoSchedule } from '@/features/schedules/generation/actions';
import { finalizeSchedule, publishSchedule } from '@/features/schedules/draft-schedule/actions';
import type { ScheduleStatus } from '@/generated/prisma/client';
import { STATUS_COLORS, STATUS_LABELS } from '../../constants';
import { invalidateScheduleQueries } from '@/features/schedules/hooks';

type Props = {
  scheduleId: string;
  scheduleStatus: ScheduleStatus | null;
  hasUnpublishedDraft?: boolean;
};

export function DraftActions({ scheduleId, scheduleStatus, hasUnpublishedDraft = false }: Props) {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<'generate' | 'finalize' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const invalidate = () => invalidateScheduleQueries(queryClient, scheduleId);

  const generateMutation = useMutation({
    mutationFn: () => generateAutoSchedule(scheduleId),
    onSuccess: (res) => {
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setMessage('השיבוץ האוטומטי נוצר בהצלחה');
      invalidate();
    },
    onError: () => setError('שגיאה ביצירת שיבוץ אוטומטי'),
    onSettled: () => setPendingAction(null),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => finalizeSchedule(scheduleId),
    onSuccess: (res) => {
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setMessage('אין שגיאות חוסמות — ניתן לפרסם');
      invalidate();
    },
    onSettled: () => setPendingAction(null),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishSchedule(scheduleId),
    onSuccess: (res) => {
      if ('error' in res) {
        setError(res.error);
        return;
      }
      invalidate();
    },
    onSettled: () => setPendingAction(null),
  });

  const pending = generateMutation.isPending || finalizeMutation.isPending || publishMutation.isPending;

  function handleGenerate() {
    setError(null);
    setMessage(null);
    setPendingAction('generate');
    generateMutation.mutate();
  }

  function handleFinalize() {
    if (!scheduleId) return;
    setError(null);
    setMessage(null);
    setPendingAction('finalize');
    finalizeMutation.mutate();
  }

  function handlePublish() {
    if (!scheduleId) return;
    setError(null);
    setMessage(null);
    setPendingAction('publish');
    publishMutation.mutate();
  }

  // Compare string literals — do not import Prisma enum values here (client bundle cannot load @/generated/prisma runtime).
  const isPublished = scheduleStatus === 'PUBLISHED' && !hasUnpublishedDraft;
  const canGenerate =
    scheduleStatus === 'DRAFT' ||
    scheduleStatus === 'OPEN' ||
    scheduleStatus === 'LOCKED' ||
    scheduleStatus === 'PUBLISHED' ||
    scheduleStatus === null;
  const canPublishDraft = !isPublished || hasUnpublishedDraft;

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

      {canGenerate && (
        <Button size="sm" variant="default" onClick={handleGenerate} disabled={pending} className="gap-1.5">
          <Sparkles className="w-4 h-4" />
          {pendingAction === 'generate' ? 'יוצר שיבוץ...' : 'צור שיבוץ אוטומטי'}
        </Button>
      )}

      {canGenerate && (
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
        disabled={!scheduleId || pending || !canPublishDraft}
        className="gap-1.5"
      >
        <Send className="w-4 h-4" />
        {isPublished ? 'פורסם לעובדים' : 'פרסם שיבוץ'}
      </Button>
    </div>
  );
}
