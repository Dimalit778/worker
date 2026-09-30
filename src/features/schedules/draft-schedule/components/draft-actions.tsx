'use client';
import { PeriodScheduleStatus } from '@/features/schedules/period-status';

import { useVersionExpectation } from '../../shared/version-context';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Send, Sparkles } from 'lucide-react';
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
import { finalizeSchedule, publishSchedule } from '@/features/schedules/draft-schedule/actions';
import { STATUS_COLORS, STATUS_LABELS } from '../../constants';
import { invalidateScheduleQueries } from '@/features/schedules/hooks';

type Props = {
  scheduleId: string;
  scheduleStatus: PeriodScheduleStatus | null;
  hasUnpublishedDraft?: boolean;
};

export function DraftActions({ scheduleId, scheduleStatus, hasUnpublishedDraft = false }: Props) {
  const queryClient = useQueryClient();
  const expected = useVersionExpectation();
  const [reason, setReason] = useState('');
  const [pendingAction, setPendingAction] = useState<'generate' | 'finalize' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [confirmPublishMessage, setConfirmPublishMessage] = useState<string | null>(null);

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

  const finalizeMutation = useMutation({
    mutationFn: () => finalizeSchedule(scheduleId, expected),
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
    mutationFn: (confirmIssues: boolean) => publishSchedule(scheduleId, { ...expected, confirmIssues, reason }),
    onSuccess: (res) => {
      if ('requiresConfirmation' in res) {
        setConfirmPublishMessage(res.message ?? 'לפרסם עם אזהרות?');
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

  const pending = generateMutation.isPending || finalizeMutation.isPending || publishMutation.isPending;

  function handleGenerate() {
    setError(null);
    setMessage(null);
    if (!window.confirm('יצירה מחדש תחליף את כל האיושים שאינם נעולים, כולל שינויים ידניים. להמשיך?')) return;
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
        {scheduleStatus && (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[scheduleStatus]}`}
          >
            {STATUS_LABELS[scheduleStatus]}
          </span>
        )}

        <input aria-label="סיבת פרסום או שינוי" placeholder="סיבת פרסום או שינוי" value={reason} onChange={e => setReason(e.target.value)} className="rounded border px-2 py-1 text-sm" />
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
          disabled={!scheduleId || pending || !canPublishDraft || !reason.trim()}
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
              {confirmPublishMessage ?? 'בשיבוץ קיימות בעיות או אזהרות פתוחות. האם לפרסם בכל זאת?'}
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
    </>
  );
}
