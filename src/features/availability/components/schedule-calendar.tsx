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
import { discardAvailabilityDraft, submitAvailability } from '../actions';
import { invalidateAvailabilityCurrent, invalidateMySubmissions } from '../hooks';
import type { ShiftType } from '@/generated/prisma/client';
import { PeriodInfo } from '../types';
import {
  applyPreference,
  chunkWeeks,
  datesInRange,
  DAY_HE,
  hasSubmitted,
  NO_CHOICE_LABEL,
  normalizeEntries,
  PREFERENCE_LABEL,
  sameEntries,
  SHIFTS,
  validateAvailabilityEntries,
  weeklyMinimumError,
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
  /** Approved time-off dates; weeks containing one are exempt from the weekly minimum. */
  timeOffDates?: string[];
  viewOnly?: boolean;
  /** When false, hides the submission status badge (e.g. נשלח). Defaults to true. */
  showStatus?: boolean;
};

const SHIFT_KEYS = SHIFTS.map((s) => s.key);

/** Selection = blue (+ check icon); not color-only. Success/warnings live in status, not cells. */
const STATE_STYLE: Record<Preference, string> = {
  AVAILABLE:
    'border border-blue-500 bg-blue-600 text-white shadow-sm hover:border-blue-400 hover:bg-blue-500 focus-visible:ring-blue-300',
  PREFERRED:
    'border-2 border-blue-300 bg-blue-500 text-white shadow-sm hover:border-blue-200 hover:bg-blue-400 focus-visible:ring-blue-300',
  UNAVAILABLE:
    'border border-rose-500/60 bg-rose-950/70 text-rose-100 hover:bg-rose-900/80 focus-visible:ring-rose-300',
};
/** Unselected: lighter than page bg, solid subtle border so the hit target is obvious. */
const EMPTY_STYLE =
  'border border-solid border-foreground/25 bg-secondary text-muted-foreground hover:border-foreground/40 hover:bg-accent hover:text-foreground focus-visible:ring-ring';

const SUBMITTED_STATUS_STYLE = 'bg-green-900 text-green-100';

/** Always-visible weekly minimum reminder in the employee availability header (two lines). */
const WEEKLY_MINIMUM_HINT_LINES = [
  'מינימום 2 בקרים וערב בכל שבוע (לא כולל שישי, שבת, חגים)',
  'מי שלא מגיש מינימום חייב להוסיף פירוט',
] as const;

function StateIcon({ preference }: { preference: Preference | undefined }) {
  const iconClass = 'size-3.5 sm:size-4';
  if (preference === 'AVAILABLE') return <Check className={iconClass} aria-hidden />;
  if (preference === 'PREFERRED') return <Star className={`${iconClass} fill-current`} aria-hidden />;
  if (preference === 'UNAVAILABLE') return <X className={iconClass} aria-hidden />;
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
  timeOffDates = [],
  viewOnly = false,
  showStatus = true,
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

  const pending = submitMutation.isPending || discardMutation.isPending;
  const error =
    [submitMutation, discardMutation].map((m) => m.data?.error).find(Boolean) ??
    ([submitMutation, discardMutation].some((m) => m.isError) ? 'השמירה נכשלה. הבחירות נשמרו במסך; אפשר לנסות שוב.' : null);

  const weeks = chunkWeeks(datesInRange(period.startDate, period.endDate));
  const readonly = viewOnly || period.status === 'LOCKED' || period.status === 'ARCHIVED';
  const editable = !readonly && period.status === 'OPEN';
  const dirty = !sameEntries(entries, saved.entries) || note !== saved.note;
  const submittedOnce = hasSubmitted(status);
  const hasServerDraft = status === 'DRAFT' || status === 'UNSUBMITTED_CHANGES';
  const minimumError = editable
    ? weeklyMinimumError(
        validateAvailabilityEntries(entries, period.startDate, period.endDate),
        period.startDate,
        period.endDate,
        new Set(timeOffDates),
        note,
      )
    : null;
  const canSubmit = !pending && minimumError == null && !(status === 'SUBMITTED' && !dirty);

  const cancelLocalChanges = () => {
    setEntries(saved.entries);
    setNote(saved.note);
  };

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

  const showHeader =
    !viewOnly || showStatus || (editable && dirty) || (!viewOnly && Boolean(closesAt));

  return (
    <div className="space-y-5" dir="rtl">
      {showHeader ? (
        <div className="flex flex-col gap-3 text-sm md:grid md:grid-cols-2 md:items-start md:gap-4">
          {/* Mobile: dates first. Desktop RTL: col 2 = visual left */}
          {!viewOnly ? (
            <div className="flex items-start justify-between gap-3 md:col-start-2 md:flex-col md:items-end md:gap-1 md:text-end">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-base font-semibold">
                  {formatDate(period.startDate)} – {formatDate(period.endDate)}
                </span>
                {closesAt ? (
                  <span className="text-xs text-muted-foreground">מועד סגירה: {formatInstant(closesAt)}</span>
                ) : null}
              </div>
              {showStatus && submittedOnce ? (
                <Badge className={cn('h-6 shrink-0 px-3 text-sm', SUBMITTED_STATUS_STYLE)} data-testid="availability-status">
                  נשלח
                </Badge>
              ) : null}
            </div>
          ) : showStatus && submittedOnce ? (
            <div className="flex justify-center md:col-span-2">
              <Badge className={cn('h-6 px-3 text-sm', SUBMITTED_STATUS_STYLE)} data-testid="availability-status">
                נשלח
              </Badge>
            </div>
          ) : null}

          {/* Mobile: rules below. Desktop RTL: col 1 = visual right */}
          {!viewOnly ? (
            <ul className="w-full list-none space-y-1 text-xs font-semibold leading-snug text-muted-foreground sm:text-sm md:col-start-1 md:row-start-1 md:max-w-md md:space-y-0.5">
              {WEEKLY_MINIMUM_HINT_LINES.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

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
                          className={cn('border-e last:border-e-0 border-border p-0.5 sm:p-1', isWeekend && 'bg-muted/60')}
                        >
                          <button
                            type="button"
                            onClick={() => handleCycle(date, shift.key)}
                            disabled={!editable}
                            data-state={value ?? 'EMPTY'}
                            aria-label={`${date} ${shift.label}: ${value ? PREFERENCE_LABEL[value] : NO_CHOICE_LABEL}`}
                            title={value ? PREFERENCE_LABEL[value] : NO_CHOICE_LABEL}
                            className={cn(
                              'flex min-h-9 w-full items-center justify-center rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-11',
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
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <Button
            type="button"
            disabled={!canSubmit}
            className={cn(
              canSubmit &&
                'border-emerald-300 bg-emerald-200 text-emerald-950 hover:bg-emerald-100 hover:text-emerald-950',
            )}
            onClick={() => submitMutation.mutate({ periodId: period.id, entries, note })}
          >
            {submitMutation.isPending ? 'מגיש...' : 'הגש שיבוץ'}
          </Button>
          {dirty ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={cancelLocalChanges}
            >
              ביטול שינויים
            </Button>
          ) : hasServerDraft ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => discardMutation.mutate(period.id)}
            >
              {submittedOnce ? 'בטל שינויים וחזור להגשה' : 'מחק טיוטה'}
            </Button>
          ) : null}
          {error && (
            <p role="alert" className="basis-full text-center text-sm text-destructive">
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
