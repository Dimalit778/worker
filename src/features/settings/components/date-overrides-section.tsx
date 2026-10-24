'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import type { DayCategory, ShiftType } from '@/generated/prisma/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SHIFT_LABELS, SHIFT_ORDER } from '@/features/settings/constans';
import { deleteStaffingDateOverride, saveStaffingDateOverride } from '@/features/settings/actions';
import { invalidateSettingsQueries } from '@/features/settings/hooks';
import { MAX_OVERRIDE_COUNT, MAX_OVERRIDE_LABEL_LENGTH } from '@/features/settings/date-overrides';
import type { StaffingDateOverrideRow } from '@/features/settings/queries';
import { invalidateScheduleQueries } from '@/features/schedules/hooks';
import { getDayCategoryForDate } from '@/features/schedules/utils';
import { calendarDateISO } from '@/features/periods/utils';
import { cn } from '@/lib/utils';

type PositionOption = { id: string; name: string; rank: number };

type StaffingRow = {
  positionId: string;
  shiftType: ShiftType;
  dayCategory: DayCategory;
  requiredCount: number;
};

type Counts = Record<string, string>;

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function countKey(shift: ShiftType, positionId: string) {
  return `${shift}|${positionId}`;
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split('-');
  const weekday = DAY_NAMES[new Date(`${iso}T00:00:00.000Z`).getUTCDay()];
  return `יום ${weekday}, ${day}/${month}/${year}`;
}

/** Prefill: existing override for the date, otherwise the regular requirement of its day category. */
function initialCounts(
  date: string,
  positions: PositionOption[],
  capacities: StaffingRow[],
  overrides: StaffingDateOverrideRow[],
): Counts {
  const counts: Counts = {};
  const category = date ? getDayCategoryForDate(date) : 'WEEKDAY';
  const existing = overrides.filter((row) => row.date === date);
  for (const shift of SHIFT_ORDER) {
    for (const position of positions) {
      const override = existing.find((row) => row.shiftType === shift && row.positionId === position.id);
      const regular = capacities.find(
        (row) => row.dayCategory === category && row.shiftType === shift && row.positionId === position.id,
      );
      counts[countKey(shift, position.id)] = String(override?.requiredCount ?? regular?.requiredCount ?? 0);
    }
  }
  return counts;
}

export function DateOverridesSection({
  facilityId,
  positions,
  capacities,
  overrides,
}: {
  facilityId: string;
  positions: PositionOption[];
  capacities: StaffingRow[];
  overrides: StaffingDateOverrideRow[];
}) {
  const queryClient = useQueryClient();
  const today = calendarDateISO(new Date(), 'Asia/Jerusalem');
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [counts, setCounts] = useState<Counts>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byDate = new Map<string, StaffingDateOverrideRow[]>();
    for (const row of overrides) byDate.set(row.date, [...(byDate.get(row.date) ?? []), row]);
    return [...byDate.entries()].map(([groupDate, rows]) => ({
      date: groupDate,
      label: rows.find((row) => row.label)?.label ?? null,
      rows,
    }));
  }, [overrides]);

  function selectDate(nextDate: string) {
    setDate(nextDate);
    setErrorMsg('');
    if (!nextDate) {
      setCounts({});
      return;
    }
    setCounts(initialCounts(nextDate, positions, capacities, overrides));
    const existingLabel = overrides.find((row) => row.date === nextDate && row.label)?.label;
    if (existingLabel) setLabel(existingLabel);
  }

  function resetForm() {
    setDate('');
    setLabel('');
    setCounts({});
  }

  function onDone() {
    setErrorMsg('');
    invalidateSettingsQueries(queryClient, facilityId);
    invalidateScheduleQueries(queryClient);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = SHIFT_ORDER.flatMap((shiftType) =>
        positions.map((position) => {
          const raw = counts[countKey(shiftType, position.id)] ?? '0';
          const amount = Number(raw);
          if (raw.trim() === '' || !Number.isInteger(amount) || amount < 0 || amount > MAX_OVERRIDE_COUNT) {
            throw new Error(`התקן חייב להיות מספר שלם בין 0 ל־${MAX_OVERRIDE_COUNT}`);
          }
          return { positionId: position.id, shiftType, amount };
        }),
      );
      const res = await saveStaffingDateOverride({ date, label: label.trim() || null, entries });
      if ('error' in res) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      onDone();
      resetForm();
    },
    onError: (error: Error) => setErrorMsg(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (targetDate: string) => {
      const res = await deleteStaffingDateOverride(targetDate);
      if ('error' in res) throw new Error(res.error);
      return res;
    },
    onSuccess: (_res, targetDate) => {
      setConfirmDelete(null);
      if (targetDate === date) resetForm();
      onDone();
    },
    onError: (error: Error) => setErrorMsg(error.message),
  });

  const isEditing = !!date && overrides.some((row) => row.date === date);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="space-y-4 rounded-xl border border-border/80 bg-card/40 p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="override-date">תאריך</Label>
            <div className="relative">
              <Input
                id="override-date"
                type="date"
                dir="ltr"
                min={today}
                value={date}
                onChange={(e) => selectDate(e.target.value)}
                className={cn(
                  'block max-w-full appearance-none [&::-webkit-date-and-time-value]:min-h-6 [&::-webkit-date-and-time-value]:text-right [&::-webkit-datetime-edit]:p-0',
                  !date && 'text-transparent',
                )}
              />
              {!date && (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  בחר תאריך
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="override-label">תיאור</Label>
            <Input
              id="override-label"
              placeholder="לדוגמה: ראש השנה"
              maxLength={MAX_OVERRIDE_LABEL_LENGTH}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>

        {date ? (
          <>
            <p className="text-sm text-muted-foreground">
              {isEditing ? 'עריכת התקן החריג עבור ' : 'התקן מולא לפי סוג היום עבור '}
              {formatDate(date)}. הכמויות שיישמרו יחליפו את התקן הרגיל לתאריך זה בלבד.
            </p>
            <div className="overflow-x-auto overscroll-x-contain">
              <div className="inline-flex min-w-full gap-4 sm:gap-6 md:justify-center">
                {SHIFT_ORDER.map((shift) => (
                  <div key={shift} className="flex w-full max-w-32 flex-col gap-2">
                    <span className="text-center text-xs font-semibold text-muted-foreground">{SHIFT_LABELS[shift]}</span>
                    <div className="flex flex-col gap-3 rounded-lg border border-border/50 p-2">
                      {positions.map((position) => (
                        <div key={position.id} className="flex flex-col items-center gap-1">
                          <span className="line-clamp-2 text-center text-[11px] font-medium text-muted-foreground sm:text-xs">
                            {position.name}
                          </span>
                          <Input
                            type="number"
                            min={0}
                            max={MAX_OVERRIDE_COUNT}
                            inputMode="numeric"
                            aria-label={`${SHIFT_LABELS[shift]} ${position.name}`}
                            value={counts[countKey(shift, position.id)] ?? '0'}
                            onChange={(e) =>
                              setCounts((prev) => ({ ...prev, [countKey(shift, position.id)]: e.target.value }))
                            }
                            className={cn(
                              'mx-auto h-8 max-w-18 px-2 text-center text-sm font-semibold tabular-nums',
                              '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={resetForm} disabled={saveMutation.isPending}>
                ביטול
              </Button>
              <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'שומר...' : 'שמור תקן חריג'}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">בחר תאריך כדי להגדיר עבורו תקן חריג.</p>
        )}
      </div>

      {errorMsg ? <p className="text-sm text-destructive">{errorMsg}</p> : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">תקנים חריגים קרובים</h3>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">לא הוגדרו תקנים חריגים לתאריכים הקרובים.</p>
        ) : (
          <ul className="space-y-2">
            {groups.map((group) => (
              <li key={group.date} className="space-y-2 rounded-xl border border-border/80 bg-card/40 p-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{formatDate(group.date)}</span>
                    {group.label ? <Badge variant="secondary">{group.label}</Badge> : null}
                  </div>
                  <div className="flex gap-2">
                    {confirmDelete === group.date ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(group.date)}
                        >
                          {deleteMutation.isPending ? 'מוחק...' : 'אישור מחיקה'}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>
                          ביטול
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={() => selectDate(group.date)}>
                          עריכה
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDelete(group.date)}>
                          מחיקה
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {SHIFT_ORDER.map((shift) => {
                    const rows = group.rows.filter((row) => row.shiftType === shift);
                    if (!rows.length) return null;
                    return (
                      <p key={shift}>
                        <span className="font-medium text-foreground">{SHIFT_LABELS[shift]}: </span>
                        {rows.map((row) => `${row.positionName} ${row.requiredCount}`).join(' · ')}
                      </p>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
