'use client';

import type { ReactNode } from 'react';
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
import { SHIFT_LABELS } from '@/features/schedules/constants';
import type { VersionExpectation } from '../../services/transactions';
import type { ScheduleWarningSummary } from '../../types';
import { usePublishReview } from '../hooks';
import { countChanges, type SlotChange } from '../utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: string;
  expected: VersionExpectation;
  pending: boolean;
  /** confirmIssues: true when the manager has seen and accepted ERROR warnings in this review. */
  onConfirm: (confirmIssues: boolean) => void;
};

const formatDay = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

function where(w: { date: string | null; shiftType: keyof typeof SHIFT_LABELS | null; positionName: string | null }) {
  return [formatDay(w.date), w.shiftType ? SHIFT_LABELS[w.shiftType] : null, w.positionName].filter(Boolean).join(' · ');
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">
        {title} <span className="text-muted-foreground tabular-nums">({count})</span>
      </h3>
      {children}
    </section>
  );
}

function WarningList({ warnings, empty }: { warnings: ScheduleWarningSummary[]; empty: string }) {
  if (!warnings.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
      {warnings.map((w) => (
        <li key={w.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
          <span className="block text-xs text-muted-foreground">{where(w)}</span>
          {w.employeeName && <span className="font-medium">{w.employeeName}: </span>}
          {w.message}
        </li>
      ))}
    </ul>
  );
}

const CHANGE_LABELS: Record<SlotChange['kind'], string> = { added: 'נוסף', removed: 'הוסר', reassigned: 'הוחלף' };

function ChangeText({ change }: { change: SlotChange }) {
  if (change.kind === 'reassigned') return <>{change.fromEmployeeName} ← {change.toEmployeeName}</>;
  return <>{change.kind === 'added' ? change.toEmployeeName : change.fromEmployeeName}</>;
}

/** Shown before publishing: shortages, exceptions and changes against the published version. */
export function PublishReviewDialog({ open, onOpenChange, scheduleId, expected, pending, onConfirm }: Props) {
  const { data, isLoading, isError } = usePublishReview(scheduleId, expected, open);
  const review = data?.ok ? data : null;
  const counts = review ? countChanges(review.changes) : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto data-[size=default]:sm:max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>סקירה לפני פרסום</AlertDialogTitle>
          <AlertDialogDescription>
            {review
              ? review.isFirstPublication
                ? 'זהו הפרסום הראשון של השיבוץ לתקופה זו.'
                : `השוואה לגרסה המפורסמת (גרסה ${review.publishedVersionNumber}).`
              : 'בדקו חוסרים ושינויים לפני שהשיבוץ יוצג לעובדים.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground">טוען סקירה...</p>}
        {isError && <p className="text-sm text-destructive">לא ניתן לטעון את הסקירה.</p>}
        {data && !data.ok && <p className="text-sm text-destructive">{data.error}</p>}

        {review && counts && (
          <div className="space-y-5 text-right">
            <Section title="חוסרים" count={review.shortages.length}>
              <WarningList warnings={review.shortages} empty="כל המשמרות מאוישות." />
            </Section>

            <Section title="בעיות" count={review.issues.length}>
              <WarningList warnings={review.issues} empty="לא נמצאו בעיות." />
            </Section>

            {!review.isFirstPublication && (
              <Section title="שינויים ביחס לגרסה המפורסמת" count={review.changes.length}>
                {review.changes.length ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      נוספו {counts.added} · הוסרו {counts.removed} · הוחלפו {counts.reassigned}
                    </p>
                    <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
                      {review.changes.map((c, i) => (
                        <li key={`${c.date}-${c.shiftType}-${c.positionId}-${i}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                          <span className="min-w-0">
                            <span className="block text-xs text-muted-foreground">{where(c)}</span>
                            <span className="font-medium"><ChangeText change={c} /></span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">{CHANGE_LABELS[c.kind]}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">אין שינויים בשיבוץ העובדים.</p>
                )}
              </Section>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>חזור לשיבוץ</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm((review?.errorCount ?? 0) > 0)} disabled={pending || isLoading}>
            {review && review.errorCount > 0 ? 'פרסם למרות הבעיות' : 'פרסם שיבוץ'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
