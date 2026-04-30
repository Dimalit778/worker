'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { PERIOD_OPTIONS } from '../constants';
import { createPeriod } from '../actions';
import { PeriodType } from '../types';

import { upcomingSundayISO, suggestName, deriveFields } from '../utils';
export function CreatePeriodForm({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>('biweekly');
  const [name, setName] = useState(() => suggestName(upcomingSundayISO(), 14));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleClose = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const sun = upcomingSundayISO();
    const d = PERIOD_OPTIONS.find((o) => o.value === periodType)!.days;
    setName(suggestName(sun, d));
  }, [open, periodType]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, handleClose]);

  const days = PERIOD_OPTIONS.find((o) => o.value === periodType)!.days;
  const startSunday = upcomingSundayISO();
  const { end: endDate, deadline: submissionDeadline } = deriveFields(startSunday, days);

  function handleTypeChange(t: PeriodType) {
    setPeriodType(t);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const sun = upcomingSundayISO();
      const d = PERIOD_OPTIONS.find((o) => o.value === periodType)!.days;
      const { end, deadline } = deriveFields(sun, d);
      const res = await createPeriod({ name, startDate: sun, endDate: end, submissionDeadline: deadline });
      if ('error' in res) {
        setError(res.error);
      } else {
        setOpen(false);
        onCreated?.();
      }
    });
  }

  const modal = open && mounted && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="סגור" className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-period-title"
        className="relative z-10 w-full max-w-lg max-h-[min(90vh,720px)] overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg space-y-5"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="create-period-title" className="font-semibold text-sm">
            תקופת שיבוץ חדשה
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
            aria-label="סגור"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">סוג שיבוץ</span>
            <div className="grid grid-cols-2 gap-2">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleTypeChange(opt.value)}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-lg border-2 py-3 px-4 text-sm font-medium transition-all',
                    periodType === opt.value
                      ? 'border-foreground bg-foreground/5 text-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                  )}
                >
                  <span>{opt.label}</span>
                  <span className="text-xs font-normal opacity-60">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="period-start" className="text-xs font-medium text-muted-foreground block">
              תאריך התחלה — ראשון הקרוב
            </label>
            <input
              id="period-start"
              type="date"
              value={startSunday}
              readOnly
              aria-readonly="true"
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted/40 cursor-default focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              מחליפים שבועי / דו-שבועי או פותחים את החלון — תאריך ההתחלה מתעדכן לראשון הקרוב. יצירת התקופה משתמשת בתאריך
              זה.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-muted/40 rounded-lg px-3 py-2.5 text-xs">
            <div>
              <p className="text-muted-foreground">תאריך סיום</p>
              <p className="font-medium mt-0.5" dir="ltr">
                {endDate}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">מועד אחרון להגשה</p>
              <p className="font-medium mt-0.5" dir="ltr">
                {submissionDeadline.replace('T', ' ')}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="period-name" className="text-xs font-medium text-muted-foreground block">
              שם (ניתן לשינוי)
            </label>
            <input
              id="period-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="bg-foreground text-background text-sm px-5 py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {pending ? 'יוצר...' : 'צור תקופה'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-foreground text-background text-sm px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
        </svg>
        תקופה חדשה
      </button>
      {modal ? createPortal(modal, document.body) : null}
    </>
  );
}
