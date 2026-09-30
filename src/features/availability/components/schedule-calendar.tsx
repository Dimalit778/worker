'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { submitAvailability } from '../actions';
import { invalidateAvailabilityCurrent, invalidateMySubmissions } from '../hooks';
import type { ShiftType } from '@/generated/prisma/client';
import { PeriodInfo } from '../types';
import { datesInRange, SHIFTS, DAY_HE } from '../utils';

type Props = {
  period: PeriodInfo;
  initialEntries: Record<string, boolean | 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE'>;
  initialSubmitted: boolean;
  initialNote?: string;

  viewOnly?: boolean;
};

export function ScheduleCalendar({
  period,
  initialEntries,
  initialSubmitted,
  initialNote = '',
  viewOnly = false,
}: Props) {
  const [entries, setEntries] = useState<Record<string, boolean | 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE'>>(initialEntries);
  const [note, setNote] = useState(initialNote);
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: submitAvailability,
    onSuccess: (res) => {
      if (res.ok) {
        setSubmitted(true);
        invalidateAvailabilityCurrent(queryClient);
        invalidateMySubmissions(queryClient);
      }
    },
  });

  const pending = submitMutation.isPending;

  const dates = datesInRange(period.startDate, period.endDate);
  const readonly = viewOnly || period.status === 'LOCKED' || period.status === 'ARCHIVED';

  // Split into two weeks for layout
  const week1 = dates.slice(0, 7);
  const week2 = dates.slice(7, 14);

  function handleToggle(date: string, shiftType: ShiftType) {
    if (readonly) return;
    const key = `${date}-${shiftType}`;
    setEntries((prev) => ({ ...prev, [key]: (prev[key] === 'PREFERRED' ? 'UNAVAILABLE' : prev[key] === 'AVAILABLE' || prev[key] === true ? 'PREFERRED' : 'AVAILABLE') }));
  }

  function handleSubmit() {
    submitMutation.mutate({ periodId: period.id, entries, note });
  }

  const selected = Object.values(entries).filter(v => v === true || v === 'AVAILABLE' || v === 'PREFERRED').length;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{viewOnly ? 'לוח זמינות' : 'לוח משמרות'}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{period.name}</p>
        </div>
        {viewOnly ? (
          submitted ? (
            <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-green-100 text-green-700 rounded-full font-medium">
              <span>✓</span> זמינות הוגשה
            </span>
          ) : (
            <span className="text-xs text-muted-foreground px-2 py-1 rounded-md border border-border bg-muted/40">
              צפייה בלבד
            </span>
          )
        ) : submitted ? (
          <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-green-100 text-green-700 rounded-full font-medium">
            <span>✓</span> זמינות הוגשה
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">{selected} משמרות נבחרו</span>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-xs">
        {SHIFTS.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className={cn('w-3 h-3 rounded-sm', s.bg)} />
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Two-week grid */}
      {[week1, week2].map((week, wi) => (
        <div key={wi} className="rounded-xl border border-border overflow-hidden bg-white shadow-sm">
          <div className="bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border">
            שבוע {wi + 1}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="w-14 px-3 py-2.5 text-right font-medium border-b border-e border-border bg-muted/30 sticky right-0 z-10">
                    משמרת
                  </th>
                  {week.map((date) => {
                    const d = new Date(`${date}T12:00:00Z`);
                    const [, m, day] = date.split('-');
                    const isWeekend = d.getUTCDay() === 5 || d.getUTCDay() === 6;
                    return (
                      <th
                        key={date}
                        className={cn(
                          'px-1 py-2 text-center font-medium border-b border-e last:border-e-0 border-border min-w-[56px]',
                          isWeekend && 'bg-slate-50',
                        )}
                      >
                        <div className="text-muted-foreground font-normal">{DAY_HE[d.getUTCDay()]}</div>
                        <div className="font-semibold">
                          {day}/{m}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {SHIFTS.map((shift) => (
                  <tr key={shift.key} className="border-b last:border-b-0 border-border">
                    <td className="px-3 py-2 font-medium text-right border-e border-border bg-muted/20 sticky right-0 z-10">
                      {shift.label}
                    </td>
                    {week.map((date) => {
                      const key = `${date}-${shift.key}`;
                      const on = entries[key] === true || entries[key] === 'AVAILABLE' || entries[key] === 'PREFERRED';
                      const preferred = entries[key] === 'PREFERRED';
                      const d = new Date(`${date}T12:00:00Z`);
                      const isWeekend = d.getUTCDay() === 5 || d.getUTCDay() === 6;
                      return (
                        <td
                          key={date}
                          className={cn('border-e last:border-e-0 border-border p-1', isWeekend && 'bg-slate-50/60')}
                        >
                          <button
                            onClick={() => handleToggle(date, shift.key)}
                            disabled={readonly}
                            title="לחיצה מחליפה בין לא יכול, זמין ומעדיף" aria-label={`${date} ${shift.label}: ${preferred ? 'מעדיף' : on ? 'זמין' : 'לא יכול'}`}
                            className={cn(
                              'w-full h-9 rounded-md transition-all duration-150 flex items-center justify-center',
                              on
                                ? `${shift.bg} ${shift.text} shadow-sm`
                                : 'border border-dashed border-border hover:border-solid hover:bg-muted/50',
                              readonly && 'cursor-default',
                              !readonly && !on && 'hover:scale-95',
                            )}
                          >
                            {preferred ? '★ מעדיף' : on ? '✓ זמין' : 'לא יכול'}
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
        {readonly ? (
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

      {/* Submit */}
      {!viewOnly && period.status === 'OPEN' && (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSubmit}
            disabled={pending}
            className="bg-foreground text-background text-sm px-6 py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {pending ? 'שומר...' : submitted ? 'עדכן זמינות' : 'הגש זמינות'}
          </button>
          {submitMutation.data?.error && <p role="alert">{submitMutation.data.error}</p>}
          {submitMutation.isError && <p role="alert">שמירת ההגשה נכשלה</p>}
        </div>
      )}

      {!viewOnly && period.status === 'LOCKED' && !submitted && (
        <p className="text-sm text-muted-foreground">התקופה נעולה — לא ניתן לשנות זמינות.</p>
      )}
    </div>
  );
}
