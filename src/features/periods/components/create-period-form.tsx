'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { PERIOD_OPTIONS } from '../constants';
import { createSchedule } from '../actions';
import { invalidateScheduleQueries } from '@/features/schedules/hooks';
import { PeriodType } from '../types';
import {
  RadioGroup,
  RadioGroupItem,
  Label,
  Button,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  Input,
} from '@/components/ui';
import { upcomingSundayISO, suggestName, deriveFields } from '../utils';

export function CreatePeriodForm({
  onCreated,
  triggerLabel = 'תקופה חדשה',
}: {
  onCreated?: () => void;
  triggerLabel?: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>('biweekly');
  const [name, setName] = useState(() => suggestName(upcomingSundayISO(), 14));
  const [error, setError] = useState<string | null>(null);


  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      const sun = upcomingSundayISO();
      const d = PERIOD_OPTIONS.find((o) => o.value === periodType)!.days;
      setName(suggestName(sun, d));
    } else {
      setError(null);
    }
  }

  const days = PERIOD_OPTIONS.find((o) => o.value === periodType)!.days;
  const startSunday = upcomingSundayISO();
  const { end: endDate, deadline: submissionDeadline } = deriveFields(startSunday, days);

  function handleTypeChange(t: PeriodType) {
    setPeriodType(t);
    if (open) {
      const sun = upcomingSundayISO();
      const d = PERIOD_OPTIONS.find((o) => o.value === t)!.days;
      setName(suggestName(sun, d));
    }
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const sun = upcomingSundayISO();
      const d = PERIOD_OPTIONS.find((o) => o.value === periodType)!.days;
      const { end, deadline } = deriveFields(sun, d);
      return createSchedule({ name, startDate: sun, endDate: end, submissionDeadline: deadline });
    },
    onSuccess: (res) => {
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      onCreated?.();
      invalidateScheduleQueries(queryClient);
    },
  });

  const pending = createMutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" className="gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90">
          <svg className="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
          </svg>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-lg sm:max-w-lg"
        dir="rtl"
      >
        <div className="flex items-center justify-between">
          <DialogTitle className="font-semibold text-sm">תקופת שיבוץ חדשה</DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={() => handleOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="סגור"
          >
            ×
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">סוג שיבוץ</span>
            <RadioGroup
              dir="rtl"
              value={periodType}
              onValueChange={(value) => handleTypeChange(value as PeriodType)}
              className="grid grid-cols-2 gap-3"
            >
              {PERIOD_OPTIONS.map((opt) => {
                const selected = periodType === opt.value;

                return (
                  <Label
                    key={opt.value}
                    htmlFor={opt.value}
                    className={cn(
                      'flex min-h-28 cursor-pointer items-start gap-4 rounded-3xl border p-5 transition-all',
                      'bg-background/40 hover:bg-muted/40',
                      selected
                        ? 'border-primary bg-muted/60 ring-1 ring-primary/40'
                        : 'border-border text-muted-foreground hover:border-primary/40',
                    )}
                  >
                    <RadioGroupItem
                      id={opt.value}
                      value={opt.value}
                      className="mt-1 border-4 border-muted-foreground/30 text-primary data-[state=checked]:border-primary"
                    />

                    <div className="space-y-1">
                      <div className="text-xl font-medium leading-tight text-foreground">{opt.label}</div>

                      <div className="text-base font-normal text-muted-foreground">{opt.desc}</div>
                    </div>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="period-start" className="text-xs font-medium text-muted-foreground block">
              תאריך התחלה — ראשון הבא
            </label>
            <Input
              id="period-start"
              type="date"
              value={startSunday}
              readOnly
              aria-readonly="true"
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted/40 cursor-default focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              מחליפים שבועי / דו-שבועי או פותחים את החלון — תאריך ההתחלה מתעדכן לראשון הבא. יצירת התקופה משתמשת בתאריך
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
            <Label htmlFor="period-name" className="text-xs font-medium text-muted-foreground block">
              שם
            </Label>
            <Input
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
            <Button type="submit" disabled={pending}>
              {pending ? 'יוצר...' : 'צור תקופה'}
            </Button>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              ביטול
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
