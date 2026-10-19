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
  Checkbox,
} from '@/components/ui';
import { fetchSubmissionWindowRule } from '@/features/settings/actions';
import { upcomingSundayISO, suggestName, addDays } from '../utils';
import {
  formatJerusalemLocal,
  instantForRule,
  parseJerusalemLocal,
  type SubmissionWindowRule,
} from '../submission-window';

export function CreatePeriodForm({
  onCreated,
  triggerLabel = 'תקופה חדשה',
}: {
  onCreated?: () => void;
  triggerLabel?: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(upcomingSundayISO);
  const [submissionRule, setSubmissionRule] = useState<SubmissionWindowRule | null>(null);
  const [periodType, setPeriodType] = useState<PeriodType>('biweekly');
  const [name, setName] = useState(() => suggestName(upcomingSundayISO(), 14));
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [saveRule, setSaveRule] = useState(false);
  const [hasRule, setHasRule] = useState(false);
  const [openIsPast, setOpenIsPast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function markOpenPast(value: string) {
    const instant = value ? parseJerusalemLocal(value) : null;
    setOpenIsPast(instant != null && instant.getTime() < Date.now() - 60_000);
  }

  function applyRule(rule: SubmissionWindowRule | null, start: string) {
    setHasRule(rule != null);
    if (!rule) {
      setOpensAt('');
      setClosesAt('');
      setOpenIsPast(false);
      return;
    }
    const nextOpensAt = formatJerusalemLocal(instantForRule(start, rule.openWeekday, rule.openTime));
    setOpensAt(nextOpensAt);
    setClosesAt(formatJerusalemLocal(instantForRule(start, rule.closeWeekday, rule.closeTime)));
    markOpenPast(nextOpensAt);
  }

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setError(null);
      return;
    }
    const sun = upcomingSundayISO();
    const d = PERIOD_OPTIONS.find((o) => o.value === periodType)!.days;
    setStartDate(sun);
    setName(suggestName(sun, d));
    setSaveRule(false);
    setError(null);
    try {
      const rule = await fetchSubmissionWindowRule();
      setSubmissionRule(rule);
      applyRule(rule, sun);
    } catch {
      setSubmissionRule(null);
      applyRule(null, sun);
      setError('לא ניתן לטעון את הכלל הקבוע');
    }
  }

  const days = PERIOD_OPTIONS.find((o) => o.value === periodType)!.days;
  const endDate = startDate ? addDays(startDate, days - 1) : '';

  function handleTypeChange(t: PeriodType) {
    setPeriodType(t);
    if (open) {
      const d = PERIOD_OPTIONS.find((o) => o.value === t)!.days;
      if (startDate) setName(suggestName(startDate, d));
    }
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const d = PERIOD_OPTIONS.find((o) => o.value === periodType)!.days;
      return createSchedule({
        name,
        startDate,
        endDate: addDays(startDate, d - 1),
        submissionOpensAt: opensAt,
        submissionDeadline: closesAt,
        saveAsStandingRule: saveRule,
      });
    },
    onSuccess: (res) => {
      if ('error' in res) {
        setError(res.error);
        return;
      }
      invalidateScheduleQueries(queryClient);
      onCreated?.();
      if (res.emailWarning) {
        setError(res.emailWarning);
        return;
      }
      setOpen(false);
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
        <Button type="button" className="gap-2">
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
              תאריך התחלה
            </label>
            <Input
              id="period-start"
              type="date"
              value={startDate}
              min={upcomingSundayISO()}
              required
              onChange={(event) => {
                const value = event.target.value;
                setStartDate(value);
                if (value) {
                  setName(suggestName(value, days));
                  if (submissionRule) applyRule(submissionRule, value);
                }
              }}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              אפשר לבחור תקופה מאוחרת יותר אם קיימת חפיפה. תאריך הסיום מחושב לפי משך השיבוץ שנבחר.
            </p>
          </div>

          <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-xs">
            <p className="text-muted-foreground">תאריך סיום</p>
            <p className="mt-0.5 font-medium" dir="ltr">
              {endDate}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="submission-opens" className="block text-xs font-medium text-muted-foreground">
                שליחה לעובדים
              </Label>
              <Input
                id="submission-opens"
                type="datetime-local"
                value={opensAt}
                onChange={(event) => {
                  setOpensAt(event.target.value);
                  markOpenPast(event.target.value);
                }}
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="submission-closes" className="block text-xs font-medium text-muted-foreground">
                סגירת ההגשה
              </Label>
              <Input
                id="submission-closes"
                type="datetime-local"
                value={closesAt}
                onChange={(event) => setClosesAt(event.target.value)}
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
          </div>

          {hasRule && (
            <p className="text-[11px] leading-snug text-muted-foreground">
              המועדים מולאו מהכלל הקבוע. אפשר לשנות אותם רק לתקופה הזו.
            </p>
          )}
          {openIsPast && (
            <p className="text-[11px] leading-snug text-amber-200">
              מועד השליחה המחושב כבר עבר. בחרו מועד עתידי לתקופה הזו.
            </p>
          )}

          <Label className="flex items-center gap-2 text-sm font-normal">
            <Checkbox checked={saveRule} onCheckedChange={(checked) => setSaveRule(checked === true)} />
            שמור כימים ושעות קבועים להבא
          </Label>

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
            <p className="text-sm text-red-200 bg-red-950 border border-red-200 rounded-md px-3 py-2">{error}</p>
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
