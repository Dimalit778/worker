'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatJerusalemDateTime } from '@/features/periods/submission-window';
import { formatDate } from '@/features/periods/utils';
import { discardAvailabilityDraft, saveAvailabilityDraft, submitAvailability } from '../actions';
import { invalidateAvailabilityCurrent, invalidateMySubmissions } from '../hooks';
import type { ShiftType } from '@/generated/prisma/client';
import { PeriodInfo } from '../types';
import {
  applyPreference,
  AVAILABILITY_STATUS_LABEL,
  chunkWeeks,
  datesInRange,
  DAY_HE,
  displayAvailabilityStatus,
  hasSubmitted,
  NO_CHOICE_LABEL,
  normalizeEntries,
  PREFERENCE_LABEL,
  sameEntries,
  SHIFTS,
  type AvailabilityStatus,
  type Preference,
  type PreferenceMap,
} from '../utils';

type RawEntries = Record<string, boolean | Preference>;

type Props = {
  period: PeriodInfo;
  /** Entries to show/edit (draft if one is saved, otherwise submitted). */
  initialEntries: RawEntries;
  initialSubmitted: boolean;
  initialNote?: string;
  /** Last submitted entries/note, restored when the draft is discarded. */
  submittedEntries?: RawEntries;
  submittedNote?: string;
  status?: AvailabilityStatus;
  closesAt?: string | null;
  viewOnly?: boolean;
};

const SHIFT_KEYS = SHIFTS.map((s) => s.key);

const STATE_STYLE: Record<Preference, string> = {
  AVAILABLE: 'bg-emerald-500 text-white border border-emerald-600 shadow-sm',
  PREFERRED: 'bg-amber-400 text-amber-950 border-2 border-amber-600 shadow-sm',
  UNAVAILABLE: 'bg-rose-100 text-rose-700 border border-rose-300',
};
const EMPTY_STYLE = 'border border-dashed border-border bg-background hover:border-solid hover:bg-muted/50';

const STATUS_STYLE: Record<AvailabilityStatus, string> = {
  NOT_SUBMITTED: 'bg-muted text-muted-foreground',
  DRAFT: 'bg-sky-950 text-sky-200',
  SUBMITTED: 'bg-green-950 text-green-200',
  UNSUBMITTED_CHANGES: 'bg-amber-950 text-amber-200',
};

function StateIcon({ preference }: { preference: Preference | undefined }) {
  if (preference === 'AVAILABLE') return <Check className="size-4" aria-hidden />;
  if (preference === 'PREFERRED') return <Star className="size-4 fill-current" aria-hidden />;
  if (preference === 'UNAVAILABLE') return <X className="size-4" aria-hidden />;
  return null;
}

const formatInstant = (iso: string | null | undefined) => (iso ? formatJerusalemDateTime(new Date(iso)) : null);

export function ScheduleCalendar({
  period,
  initialEntries,
  initialSubmitted,
  initialNote = '',
  submittedEntries,
  submittedNote,
  status: initialStatus,
  closesAt,
  viewOnly = false,
}: Props) {
  const [entries, setEntries] = useState<PreferenceMap>(() => normalizeEntries(initialEntries));
  const [note, setNote] = useState(initialNote);
  // What the server currently holds for editing (draft or submitted); used to detect unsaved edits.
  const [saved, setSaved] = useState(() => ({ entries: normalizeEntries(initialEntries), note: initialNote }));
  const [submittedBaseline, setSubmittedBaseline] = useState(() => ({
    entries: normalizeEntries(submittedEntries ?? (initialSubmitted ? initialEntries : {})),
    note: submittedNote ?? (initialSubmitted ? initialNote : ''),
  }));
  const [status, setStatus] = useState<AvailabilityStatus>(
    initialStatus ?? (initialSubmitted ? 'SUBMITTED' : 'NOT_SUBMITTED'),
  );
  const queryClient = useQueryClient();

  const invalidate = () => {
    invalidateAvailabilityCurrent(queryClient);
    invalidateMySubmissions(queryClient);
  };

  const draftMutation = useMutation({
    mutationFn: saveAvailabilityDraft,
    onSuccess: (res, input) => {
      if (!res.ok) return;
      setSaved({ entries: normalizeEntries(input.entries), note: input.note ?? '' });
      setStatus((prev) => (hasSubmitted(prev) ? 'UNSUBMITTED_CHANGES' : 'DRAFT'));
      invalidate();
    },
  });

  const submitMutation = useMutation({
    mutationFn: submitAvailability,
    onSuccess: (res, input) => {
      if (!res.ok) return;
      const next = { entries: normalizeEntries(input.entries), note: input.note ?? '' };
      setSaved(next);
      setSubmittedBaseline(next);
      setStatus('SUBMITTED');
      invalidate();
    },
  });

  const discardMutation = useMutation({
    mutationFn: discardAvailabilityDraft,
    onSuccess: (res) => {
      if (!res.ok) return;
      setEntries(submittedBaseline.entries);
      setNote(submittedBaseline.note);
      setSaved(submittedBaseline);
      setStatus((prev) => (hasSubmitted(prev) ? 'SUBMITTED' : 'NOT_SUBMITTED'));
      invalidate();
    },
  });

  const pending = draftMutation.isPending || submitMutation.isPending || discardMutation.isPending;
  const error =
    [draftMutation, submitMutation, discardMutation].map((m) => m.data?.error).find(Boolean) ??
    ([draftMutation, submitMutation, discardMutation].some((m) => m.isError) ? 'השמירה נכשלה. הבחירות נשמרו במסך; אפשר לנסות שוב.' : null);

  const weeks = chunkWeeks(datesInRange(period.startDate, period.endDate));
  const readonly = viewOnly || period.status === 'LOCKED' || period.status === 'ARCHIVED';
  const editable = !readonly && period.status === 'OPEN';
  const dirty = !sameEntries(entries, saved.entries) || note !== saved.note;
  const shownStatus = displayAvailabilityStatus(status, dirty);
  const submittedOnce = hasSubmitted(status);
  const hasServerDraft = status === 'DRAFT' || status === 'UNSUBMITTED_CHANGES';

  // Day/shift/week headers mark every slot they cover as available.
  const brushPreference: Preference = 'AVAILABLE';
  const brushLabel = PREFERENCE_LABEL[brushPreference];
  const paint = (dates: string[], shifts: ShiftType[]) =>
    setEntries((prev) => applyPreference(prev, dates, shifts, brushPreference));


  function handleCycle(date: string, shiftType: ShiftType) {
    if (!editable) return;
    const key = `${date}-${shiftType}`;
    setEntries((prev) => {
      const next = { ...prev };
      // A shift is either marked available or left empty.
      const value: Preference | undefined = prev[key] ? undefined : 'AVAILABLE';
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
        <span className="font-semibold">
          {formatDate(period.startDate)} – {formatDate(period.endDate)}
        </span>
        <div className="flex flex-col items-center gap-1">
          <Badge className={cn('h-6 px-3 text-sm', STATUS_STYLE[shownStatus])} data-testid="availability-status">
            {AVAILABILITY_STATUS_LABEL[shownStatus]}
          </Badge>
          {editable && dirty && <span className="text-xs font-medium text-amber-300">יש שינויים שלא נשמרו</span>}
        </div>
        <span className="text-end text-xs text-muted-foreground">
          {!viewOnly && closesAt ? <>מועד סגירה: {formatInstant(closesAt)}</> : null}
        </span>
      </div>

      {/* All weeks, stacked */}
      {weeks.map((week, wi) => week.length > 0 && (
        <div key={wi} className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
          <div className="text-center bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border">
            <span>שבוע {wi + 1}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-xs">
              <thead>
                <tr>
                  <th className="w-10 px-0 py-2.5 border-b border-e border-border bg-muted/30 sticky right-0 z-10">
                    <span className="sr-only">משמרת</span>
                  </th>
                  {week.map((date) => {
                    const d = new Date(`${date}T12:00:00Z`);
                    const [, m, day] = date.split('-');
                    const isWeekend = d.getUTCDay() === 5 || d.getUTCDay() === 6;
                    const content = (
                      <>
                        <div className="text-muted-foreground font-normal">{DAY_HE[d.getUTCDay()]}</div>
                        <div className="font-semibold">
                          {day}/{m}
                        </div>
                      </>
                    );
                    return (
                      <th
                        key={date}
                        className={cn(
                          'px-1 py-2 text-center font-medium border-b border-e last:border-e-0 border-border min-w-0',
                          isWeekend && 'bg-muted',
                        )}
                      >
                        {editable ? (
                          <button
                            type="button"
                            onClick={() => paint([date], SHIFT_KEYS)}
                            aria-label={`החל ״${brushLabel}״ על יום ${date}`}
                            className="w-full rounded-md py-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {content}
                          </button>
                        ) : (
                          content
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {SHIFTS.map((shift) => (
                  <tr key={shift.key} className="border-b last:border-b-0 border-border">
                    <td className="px-0 py-1 font-medium text-center align-middle border-e border-border bg-muted/20 sticky right-0 z-10">
                      {editable ? (
                        <button
                          type="button"
                          onClick={() => paint(week, [shift.key])}
                          aria-label={`החל ״${brushLabel}״ על משמרת ${shift.label} בשבוע ${wi + 1}`}
                          className="mx-auto block -rotate-10 rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {shift.label}
                        </button>
                      ) : (
                        <span className="block -rotate-10">{shift.label}</span>
                      )}
                    </td>
                    {week.map((date) => {
                      const key = `${date}-${shift.key}`;
                      const value = entries[key];
                      const d = new Date(`${date}T12:00:00Z`);
                      const isWeekend = d.getUTCDay() === 5 || d.getUTCDay() === 6;
                      return (
                        <td
                          key={date}
                          className={cn('border-e last:border-e-0 border-border p-1', isWeekend && 'bg-muted/60')}
                        >
                          <button
                            type="button"
                            onClick={() => handleCycle(date, shift.key)}
                            disabled={!editable}
                            data-state={value ?? 'EMPTY'}
                            aria-label={`${date} ${shift.label}: ${value ? PREFERENCE_LABEL[value] : NO_CHOICE_LABEL}`}
                            title={value ? PREFERENCE_LABEL[value] : NO_CHOICE_LABEL}
                            className={cn(
                              'w-full min-h-11 rounded-md transition-all duration-150 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                              value ? STATE_STYLE[value] : EMPTY_STYLE,
                              !editable && 'cursor-default',
                            )}
                          >
                            <StateIcon preference={value} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="space-y-2">
        <Label htmlFor="availability-note">בקשות</Label>
        {!editable ? (
          note.trim() ? (
            <p className="text-sm whitespace-pre-wrap rounded-md border border-border bg-muted/30 px-3 py-2">{note}</p>
          ) : (
            <p className="text-sm text-muted-foreground">אין הערות</p>
          )
        ) : (
          <textarea
            id="availability-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="הוסף הערות למנהל, למשל מגבלות או בקשות מיוחדות"
            className={cn(
              'w-full min-w-0 rounded-md border border-transparent bg-input/50 px-3 py-2 text-base transition-[color,box-shadow,background-color] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-y',
            )}
          />
        )}
      </div>

      {editable && (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            disabled={pending || !dirty}
            onClick={() => draftMutation.mutate({ periodId: period.id, entries, note })}
          >
            {draftMutation.isPending ? 'שומר...' : 'שמור טיוטה'}
          </Button>
          <Button
            type="button"
            disabled={pending || (status === 'SUBMITTED' && !dirty)}
            onClick={() => submitMutation.mutate({ periodId: period.id, entries, note })}
          >
            {submitMutation.isPending ? 'מגיש...' : submittedOnce ? 'הגש שינויים' : 'הגש זמינות'}
          </Button>
          {hasServerDraft && (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => discardMutation.mutate(period.id)}
            >
              {submittedOnce ? 'בטל שינויים וחזור להגשה' : 'מחק טיוטה'}
            </Button>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}

      {!viewOnly && period.status === 'LOCKED' && (
        <p className="text-sm text-muted-foreground">התקופה נעולה — לא ניתן לשנות זמינות.</p>
      )}
    </div>
  );
}
