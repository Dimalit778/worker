'use client';

import { useLayoutEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DayCategory, ShiftType } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';
import { DAY_CATEGORIES, DAY_META, SHIFT_ORDER, SHIFT_LABELS } from '@/features/settings/constans';
import { addStaffingRequirement, updateStaffingRequirement } from '@/features/settings/actions';
import { invalidateSettingsQueries } from '@/features/settings/hooks';
import { queryKeys } from '@/lib/react-query/query-keys';
import { invalidateScheduleQueries } from '@/features/schedules/hooks';
import { cn } from '@/lib/utils';
import { Moon, Sun, Sunset } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { defaultShiftTimes } from '@/features/schedules/shift-times';

const SHIFT_STYLE = {
  MORNING: { Icon: Sun, accent: 'border-l-amber-400', icon: 'text-amber-500' },
  EVENING: { Icon: Sunset, accent: 'border-l-orange-500', icon: 'text-orange-500' },
  NIGHT: { Icon: Moon, accent: 'border-l-violet-500', icon: 'text-violet-500' },
};

type PositionOption = {
  id: string;
  name: string;
  rank: number;
};

type StaffingRow = {
  id: string;
  positionId: string;
  shiftType: ShiftType;
  dayCategory: DayCategory;
  requiredCount: number;
  mandatoryCount: number;
};

type CellKey = `${DayCategory}-${ShiftType}-${string}`;

type CellState = {
  id: string | null;
  value: string;
  mandatory: string;
};

type CellField = 'value' | 'mandatory';

type GridState = Record<CellKey, CellState>;

const EMPTY_CELL: CellState = { id: null, value: '0', mandatory: '0' };

function isCellChanged(a: CellState | undefined, b: CellState | undefined) {
  return Boolean(a && b && (a.value !== b.value || a.mandatory !== b.mandatory));
}

function cellKey(day: DayCategory, shift: ShiftType, positionId: string): CellKey {
  return `${day}-${shift}-${positionId}`;
}

function buildGrid(params: { positions: PositionOption[]; capacities: StaffingRow[] }): GridState {
  const grid: GridState = {};

  for (const day of DAY_CATEGORIES) {
    for (const shift of SHIFT_ORDER) {
      for (const position of params.positions) {
        const capacity = params.capacities.find(
          (item) => item.dayCategory === day && item.shiftType === shift && item.positionId === position.id,
        );

        grid[cellKey(day, shift, position.id)] = {
          id: capacity?.id ?? null,
          value: String(capacity?.requiredCount ?? 0),
          mandatory: String(capacity?.mandatoryCount ?? 0),
        };
      }
    }
  }

  return grid;
}

function Cell({
  day,
  shift,
  position,
  cell,
  field,
  onChange,
}: {
  day: DayCategory;
  shift: ShiftType;
  position: PositionOption;
  cell: CellState;
  field: CellField;
  onChange: (day: DayCategory, shift: ShiftType, positionId: string, field: CellField, raw: string) => void;
}) {
  return (
      <Input
        type="number"
        min={0}
        max={50}
        inputMode="numeric"
        value={cell[field]}
        onChange={(e) => onChange(day, shift, position.id, field, e.target.value)}
        onBlur={(e) => {
          onChange(day, shift, position.id, field, e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }

          if (e.key === 'Escape') {
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label={`${DAY_META[day].label} ${SHIFT_LABELS[shift]} ${position.name}${field === 'mandatory' ? ' חובה' : ''}`}
        className={cn(
          'mx-auto h-8 w-16 bg-background px-2 text-center text-sm font-medium tabular-nums sm:w-24',
        )}
      />
  );
}

export function CourtCapacityRules({
  facilityId,
  positions,
  initialCapacities,
  className,
}: {
  facilityId: string;
  positions: PositionOption[];
  initialCapacities: StaffingRow[];
  className?: string;
}) {
  const initial = useMemo(
    () =>
      buildGrid({
        positions,
        capacities: initialCapacities,
      }),
    [positions, initialCapacities],
  );

  const [draft, setDraft] = useState<GridState>(initial);
  const [saved, setSaved] = useState<GridState>(initial);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedDay, setSelectedDay] = useState<DayCategory>('WEEKDAY');
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (dirtyKeys: CellKey[]) => {
      const next = { ...saved };

      for (const key of dirtyKeys) {
        const draftCell = draft[key];
        if (!draftCell) continue;

        const amount = parseInt(draftCell.value, 10);
        const mandatory = parseInt(draftCell.mandatory, 10);
        if (Number.isNaN(amount) || amount < 0 || Number.isNaN(mandatory) || mandatory < 0) {
          throw new Error('כמות חייבת להיות מספר 0 ומעלה');
        }

        const cell = saved[key] ?? EMPTY_CELL;
        const [dayCategory, shiftType, positionId] = key.split('-') as [DayCategory, ShiftType, string];

        if (mandatory > amount) {
          const positionName = positions.find((p) => p.id === positionId)?.name ?? '';
          throw new Error(`${DAY_META[dayCategory].label} · משמרת ${SHIFT_LABELS[shiftType]} · ${positionName}: החובה אינה יכולה להיות גבוהה מהתקן`);
        }

        const res = cell.id
          ? await updateStaffingRequirement(cell.id, amount, mandatory)
          : await addStaffingRequirement({
              dayCategory,
              shiftType,
              positionId,
              amount,
              mandatory,
            });

        if ('error' in res) {
          throw new Error(res.error ?? 'שמירת התקן נכשלה');
        }

        next[key] = {
          id: res.id ?? cell.id,
          value: String(amount),
          mandatory: String(mandatory),
        };
      }

      return next;
    },
    onSuccess: (next) => {
      setErrorMsg('');
      setSaved(next);
      setDraft(next);
      invalidateSettingsQueries(queryClient, facilityId);
      invalidateScheduleQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.capacities(facilityId) });
    },
    onError: (error: Error) => {
      setErrorMsg(error.message);
      setDraft({ ...saved });
    },
  });

  const isPending = saveMutation.isPending;

  useLayoutEffect(() => {
    // The grid is editable local state, but server revalidation can replace the source rows.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(initial);
    setSaved(initial);
  }, [initial]);

  const isDirty = (Object.keys(draft) as CellKey[]).some((key) => isCellChanged(draft[key], saved[key]));

  function handleChange(day: DayCategory, shift: ShiftType, positionId: string, field: CellField, raw: string) {
    const key = cellKey(day, shift, positionId);

    setDraft((grid) => {
      const prev = grid[key] ?? EMPTY_CELL;
      return {
        ...grid,
        [key]: {
          ...prev,
          [field]: raw,
        },
      };
    });
  }

  function handleSaveAll() {
    const dirtyKeys = (Object.keys(draft) as CellKey[]).filter((key) => isCellChanged(draft[key], saved[key]));

    saveMutation.mutate(dirtyKeys);
  }

  return (
    <div className={cn('space-y-5 ', className)} dir="rtl">
      <div className="flex flex-wrap gap-1 rounded-xl bg-muted/50 p-1" role="group" aria-label="סוג יום">
        {DAY_CATEGORIES.map((day) => (
          <Button
            key={day}
            type="button"
            variant={selectedDay === day ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={selectedDay === day}
            onClick={() => setSelectedDay(day)}
            className={cn('flex-1 rounded-lg', selectedDay === day && 'bg-background shadow-sm')}
          >
            {DAY_META[day].label}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {SHIFT_ORDER.map((shift) => {
          const { Icon, accent, icon } = SHIFT_STYLE[shift];
          const times = defaultShiftTimes(shift);
          return (
            <section
              key={shift}
              aria-label={`משמרת ${SHIFT_LABELS[shift]} — ${DAY_META[selectedDay].label}`}
              className={cn('flex flex-col overflow-hidden rounded-xl border border-border/70 border-l-[3px] bg-card shadow-sm sm:flex-row-reverse', accent)}
            >
              <div className="flex shrink-0 flex-row-reverse items-start justify-end gap-3 p-4 sm:w-48 sm:justify-start">
                <Icon className={cn('mt-0.5 size-6 shrink-0', icon)} aria-hidden="true" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">משמרת {SHIFT_LABELS[shift]}</h3>
                  <p className="text-xs text-muted-foreground tabular-nums" dir="ltr">{times.startTime} – {times.endTime}</p>
                </div>
              </div>
              <div className="min-w-0 flex-1 p-3 pt-0 sm:pt-3">
                <table className="w-full text-sm">
                  <caption className="sr-only">תקנים למשמרת {SHIFT_LABELS[shift]} — {DAY_META[selectedDay].label}</caption>
                  <thead className="bg-muted/30 text-xs text-muted-foreground">
                    <tr className="border-b border-border/50">
                      <th scope="col" className="rounded-tr-lg px-3 py-2 text-right font-medium">תפקיד</th>
                      <th scope="col" className="px-3 py-2 text-center font-medium sm:w-36">תקן נדרש</th>
                      <th scope="col" className="rounded-tl-lg px-3 py-2 text-center font-medium sm:w-36">חובה</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {positions.map((position) => (
                      <tr key={position.id}>
                        <th scope="row" className="px-3 py-1.5 text-right font-medium">{position.name}</th>
                        <td className="px-3 py-1.5">
                          <Cell
                            day={selectedDay}
                            shift={shift}
                            position={position}
                            cell={draft[cellKey(selectedDay, shift, position.id)] ?? EMPTY_CELL}
                            field="value"
                            onChange={handleChange}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Cell
                            day={selectedDay}
                            shift={shift}
                            position={position}
                            cell={draft[cellKey(selectedDay, shift, position.id)] ?? EMPTY_CELL}
                            field="mandatory"
                            onChange={handleChange}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      {errorMsg ? <p className="text-sm text-destructive">{errorMsg}</p> : null}

      {isDirty && (
        <div className="sticky bottom-0 z-10 -mx-1 mt-2 flex flex-col gap-2 rounded-xl border border-border/80 bg-background/90 p-3 shadow-lg backdrop-blur sm:bottom-2 sm:mx-0 sm:flex-row sm:items-center sm:justify-between supports-backdrop-filter:bg-background/75">
          <p className="text-sm text-muted-foreground">יש שינויים שטרם נשמרו</p>
          <Button type="button" onClick={handleSaveAll} disabled={isPending} className="w-full sm:w-auto">
            {isPending ? 'שומר...' : 'שמור שינויים'}
          </Button>
        </div>
      )}
    </div>
  );
}
