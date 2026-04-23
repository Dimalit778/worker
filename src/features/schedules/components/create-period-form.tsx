'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { createPeriod } from '../period-actions';

type PeriodType = 'weekly' | 'biweekly';

const PERIOD_OPTIONS: { value: PeriodType; label: string; days: number; desc: string }[] = [
  { value: 'weekly',   label: 'שבועי',     days: 7,  desc: '7 ימים' },
  { value: 'biweekly', label: 'דו-שבועי',  days: 14, desc: '14 ימים' },
];

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** "מאי 2026" / "מאי 2026 (שבוע 2)" etc. */
function suggestName(start: string, days: number): string {
  const d = new Date(`${start}T12:00:00Z`);
  const month = d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (days === 7) {
    // week number within month (1-based)
    const weekNum = Math.ceil(d.getUTCDate() / 7);
    return `${month} — שבוע ${weekNum}`;
  }
  return month;
}

function deriveFields(start: string, days: number) {
  const end = addDays(start, days - 1);
  // Deadline: 2 days before end at 17:00
  const deadline = addDays(end, -2) + 'T17:00';
  return { end, deadline };
}

export function CreatePeriodForm({ onCreated }: { onCreated?: () => void }) {
  const today = todayISO();
  const defaultStart = addDays(today, 1);

  const [open, setOpen] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>('biweekly');
  const [startDate, setStartDate] = useState(defaultStart);
  const [name, setName] = useState(() => suggestName(defaultStart, 14));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const days = PERIOD_OPTIONS.find((o) => o.value === periodType)!.days;
  const { end: endDate, deadline: submissionDeadline } = deriveFields(startDate, days);

  function handleTypeChange(t: PeriodType) {
    setPeriodType(t);
    const d = PERIOD_OPTIONS.find((o) => o.value === t)!.days;
    setName(suggestName(startDate, d));
  }

  function handleStartChange(iso: string) {
    setStartDate(iso);
    if (iso) setName(suggestName(iso, days));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createPeriod({ name, startDate, endDate, submissionDeadline });
      if ('error' in res) {
        setError(res.error);
      } else {
        setOpen(false);
        onCreated?.();
      }
    });
  }

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-foreground text-background text-sm px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
        </svg>
        תקופה חדשה
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5 shadow-sm" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm">תקופת שיבוץ חדשה</h2>
        <button
          onClick={handleClose}
          className="text-muted-foreground hover:text-foreground text-lg leading-none"
          aria-label="סגור"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Type selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">סוג שיבוץ</label>
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

        {/* Start date */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">תאריך התחלה</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleStartChange(e.target.value)}
            required
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>

        {/* Derived dates preview */}
        <div className="grid grid-cols-2 gap-3 bg-muted/40 rounded-lg px-3 py-2.5 text-xs">
          <div>
            <p className="text-muted-foreground">תאריך סיום</p>
            <p className="font-medium mt-0.5" dir="ltr">{endDate}</p>
          </div>
          <div>
            <p className="text-muted-foreground">מועד אחרון להגשה</p>
            <p className="font-medium mt-0.5" dir="ltr">{submissionDeadline.replace('T', ' ')}</p>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">שם (ניתן לשינוי)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
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
  );
}
