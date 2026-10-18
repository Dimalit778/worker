'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { DAY_NAMES_FULL } from '@/features/periods/constants';
import type { SubmissionWindowRule } from '@/features/periods/submission-window';
import { saveSubmissionWindowRule } from '@/features/settings/actions';
import { invalidateSettingsQueries } from '@/features/settings/hooks';

export function SubmissionWindowSection({
  facilityId,
  rule,
}: {
  facilityId: string;
  rule: SubmissionWindowRule | null;
}) {
  const queryClient = useQueryClient();
  const [openWeekday, setOpenWeekday] = useState(String(rule?.openWeekday ?? 3));
  const [openTime, setOpenTime] = useState(rule?.openTime ?? '10:00');
  const [closeWeekday, setCloseWeekday] = useState(String(rule?.closeWeekday ?? 5));
  const [closeTime, setCloseTime] = useState(rule?.closeTime ?? '17:00');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveSubmissionWindowRule({
        openWeekday: Number(openWeekday),
        openTime: openTime.slice(0, 5),
        closeWeekday: Number(closeWeekday),
        closeTime: closeTime.slice(0, 5),
      }),
    onSuccess: async (result) => {
      if ('error' in result) {
        setSaved(false);
        setError(result.error);
        return;
      }
      setError(null);
      setSaved(true);
      await invalidateSettingsQueries(queryClient, facilityId);
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);
        saveMutation.mutate();
      }}
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        המועדים חלים על השבוע שלפני כל תקופה חדשה. בכל שליחה אפשר לשנות אותם רק לתקופה הזו.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <DayTimeField
          label="פתיחה ושליחה לעובדים"
          dayId="submission-open-day"
          timeId="submission-open-time"
          day={openWeekday}
          time={openTime}
          onDayChange={setOpenWeekday}
          onTimeChange={setOpenTime}
        />
        <DayTimeField
          label="סגירת ההגשה"
          dayId="submission-close-day"
          timeId="submission-close-time"
          day={closeWeekday}
          time={closeTime}
          onDayChange={setCloseWeekday}
          onTimeChange={setCloseTime}
        />
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-950 px-3 py-2 text-sm text-red-200">{error}</p>}
      {saved && <p className="text-sm text-emerald-200">הכלל הקבוע נשמר</p>}

      <Button type="submit" disabled={saveMutation.isPending}>
        {saveMutation.isPending ? 'שומר...' : 'שמור כלל קבוע'}
      </Button>
    </form>
  );
}

function DayTimeField({
  label,
  dayId,
  timeId,
  day,
  time,
  onDayChange,
  onTimeChange,
}: {
  label: string;
  dayId: string;
  timeId: string;
  day: string;
  time: string;
  onDayChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={dayId} className="text-xs text-muted-foreground">
            יום
          </Label>
          <Select value={day} onValueChange={onDayChange}>
            <SelectTrigger id={dayId} className="w-full border border-border bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAY_NAMES_FULL.map((name, index) => (
                <SelectItem key={name} value={String(index)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-28 space-y-1">
          <Label htmlFor={timeId} className="text-xs text-muted-foreground">
            שעה
          </Label>
          <Input
            id={timeId}
            type="time"
            value={time}
            onChange={(event) => onTimeChange(event.target.value)}
            required
            className="border border-border bg-background"
          />
        </div>
      </div>
    </fieldset>
  );
}
