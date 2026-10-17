'use client';
import { PeriodScheduleStatus } from '@/features/schedules/period-status';

import { useVersionExpectation } from '../../shared/version-context';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { generateAutoSchedule } from '@/features/schedules/generation/actions';
import { publishSchedule } from '@/features/schedules/draft-schedule/actions';
import { invalidateScheduleQueries } from '@/features/schedules/hooks';

type Props = {
  scheduleId: string;
  scheduleStatus: PeriodScheduleStatus | null;
  hasUnpublishedDraft?: boolean;
};

export function DraftActions({ scheduleId, scheduleStatus, hasUnpublishedDraft = false }: Props) {
  const queryClient = useQueryClient();
  const expected = useVersionExpectation();
  const [pendingAction, setPendingAction] = useState<'generate' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [confirmPublishMessage, setConfirmPublishMessage] = useState<string | null>(null);
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);

  const invalidate = () => invalidateScheduleQueries(queryClient, scheduleId);

  const generateMutation = useMutation({
    mutationFn: () => generateAutoSchedule(scheduleId, expected),
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

  const publishMutation = useMutation({
    mutationFn: (confirmIssues: boolean) => publishSchedule(scheduleId, { ...expected, confirmIssues }),
    onSuccess: (res) => {
      if ('requiresConfirmation' in res) {
        setConfirmPublishMessage(res.message ?? 'לפרסם עם בעיות?');
        setConfirmPublishOpen(true);
        return;
      }
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setMessage('השיבוץ פורסם לעובדים');
      invalidate();
    },
    onSettled: () => setPendingAction(null),
  });

  const pending = generateMutation.isPending || publishMutation.isPending;

  function handleGenerate() {
    setConfirmGenerateOpen(true);
  }

  function handleConfirmGenerate() {
    setConfirmGenerateOpen(false);
    setError(null);
    setMessage(null);
    setPendingAction('generate');
    generateMutation.mutate();
  }

  function handlePublish() {
    if (!scheduleId) return;
    setError(null);
    setMessage(null);
    setPendingAction('publish');
    publishMutation.mutate(false);
  }

  function handleConfirmPublish() {
    if (!scheduleId) return;
    setError(null);
    setMessage(null);
    setPendingAction('publish');
    publishMutation.mutate(true);
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
    <>
      <div className="flex items-center gap-3 flex-wrap" dir="rtl">
        <div role="status" aria-live="polite">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-green-700">{message}</p>}
        </div>

        {canGenerate && (
          <Button size="sm" variant="default" onClick={handleGenerate} disabled={pending} className="gap-1.5">
            <Sparkles className="w-4 h-4" />
            {pendingAction === 'generate' ? 'יוצר שיבוץ...' : 'צור שיבוץ אוטומטי'}
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

      <AlertDialog open={confirmPublishOpen} onOpenChange={setConfirmPublishOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>לפרסם למרות הבעיות?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmPublishMessage ?? 'בשיבוץ קיימות בעיות פתוחות. האם לפרסם בכל זאת?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>לא, חזור לשיבוץ</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPublish} disabled={pending}>
              כן, פרסם שיבוץ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmGenerateOpen} onOpenChange={setConfirmGenerateOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>ליצור שיבוץ אוטומטי מחדש?</AlertDialogTitle>
            <AlertDialogDescription>
              יצירה מחדש תחליף את כל האיושים שאינם נעולים, כולל שינויים ידניים שביצעתם. הפעולה אינה הפיכה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmGenerate} disabled={pending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              כן, החלף את השיבוץ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
