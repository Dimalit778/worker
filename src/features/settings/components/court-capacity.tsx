'use client';

import { useLayoutEffect, useMemo, useState, useTransition } from 'react';
import type { DayCategory, ShiftType } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';
import { DAY_CATEGORIES, DAY_META, SHIFT_ORDER, SHIFT_LABELS } from '@/features/settings/constans';
import { addShiftCapacity, updateShiftCapacity } from '@/features/settings/actions';
import { AddPositionModal } from './add-position-modal';
import { cn } from '@/lib/utils';
import { ChevronDown, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';

type PositionOption = {
  id: string;
  name: string;
  code: number;
};

type ShiftCapacityRow = {
  id: string;
  positionId: string;
  shiftType: ShiftType;
  dayCategory: DayCategory;
  amount: number;
};

type CellKey = `${DayCategory}-${ShiftType}-${string}`;

type CellState = {
  id: string | null;
  value: string;
};

type GridState = Record<CellKey, CellState>;

const EMPTY_CELL: CellState = { id: null, value: '0' };

function cellKey(day: DayCategory, shift: ShiftType, positionId: string): CellKey {
  return `${day}-${shift}-${positionId}`;
}

function buildGrid(params: { positions: PositionOption[]; capacities: ShiftCapacityRow[] }): GridState {
  const grid: GridState = {};

  for (const day of DAY_CATEGORIES) {
    for (const shift of SHIFT_ORDER) {
      for (const position of params.positions) {
        const capacity = params.capacities.find(
          (item) => item.dayCategory === day && item.shiftType === shift && item.positionId === position.id,
        );

        grid[cellKey(day, shift, position.id)] = {
          id: capacity?.id ?? null,
          value: String(capacity?.amount ?? 0),
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
  onChange,
}: {
  day: DayCategory;
  shift: ShiftType;
  position: PositionOption;
  cell: CellState;
  onChange: (day: DayCategory, shift: ShiftType, positionId: string, raw: string) => void;
}) {
  const [local, setLocal] = useState(cell.value);

  useLayoutEffect(() => {
    setLocal(cell.value);
  }, [cell.value]);

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-1 py-0.5">
      <span className="line-clamp-2 min-h-9 w-full px-0.5 text-center text-[11px] font-medium leading-snug text-muted-foreground sm:text-xs">
        {position.name}
      </span>

      <Input
        type="number"
        min={0}
        max={50}
        inputMode="numeric"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onFocus={() => setLocal(cell.value)}
        onBlur={(e) => {
          onChange(day, shift, position.id, e.target.value);
          setLocal(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
          }

          if (e.key === 'Escape') {
            setLocal(cell.value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label={`${SHIFT_LABELS[shift]} ${position.name}`}
        className={cn(
          'mx-auto h-8 max-w-18 md:h-9 md:max-w-20',
          'px-2 text-center text-sm font-semibold tabular-nums md:text-sm',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        )}
      />
    </div>
  );
}

export function CourtCapacityRules({
  positions,
  initialCapacities,
  className,
}: {
  positions: PositionOption[];
  initialCapacities: ShiftCapacityRow[];
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
  const [open, setOpen] = useState<Partial<Record<DayCategory, boolean>>>({ WEEKDAY: true });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useLayoutEffect(() => {
    setDraft(initial);
    setSaved(initial);
  }, [initial]);

  const isDirty = (Object.keys(draft) as CellKey[]).some((key) => {
    const a = draft[key];
    const b = saved[key];
    return a && b && a.value !== b.value;
  });

  function toggleDay(day: DayCategory) {
    setOpen((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  }

  function handleChange(day: DayCategory, shift: ShiftType, positionId: string, raw: string) {
    const key = cellKey(day, shift, positionId);

    setDraft((grid) => {
      const prev = grid[key] ?? EMPTY_CELL;
      return {
        ...grid,
        [key]: {
          ...prev,
          value: raw,
        },
      };
    });
  }

  function handleSaveAll() {
    startTransition(async () => {
      const dirtyKeys = (Object.keys(draft) as CellKey[]).filter((key) => {
        const d = draft[key];
        const s = saved[key];
        return d && s && d.value !== s.value;
      });

      const next = { ...saved };

      for (const key of dirtyKeys) {
        const draftCell = draft[key];
        if (!draftCell) continue;

        const amount = parseInt(draftCell.value, 10);

        if (Number.isNaN(amount) || amount < 0) {
          setErrorMsg('כמות חייבת להיות מספר 0 ומעלה');
          return;
        }

        const cell = saved[key] ?? EMPTY_CELL;

        const [dayCategory, shiftType, positionId] = key.split('-') as [DayCategory, ShiftType, string];

        const res = cell.id
          ? await updateShiftCapacity(cell.id, amount)
          : await addShiftCapacity({
              dayCategory,
              shiftType,
              positionId,
              amount,
            });

        if ('error' in res) {
          setErrorMsg(res.error ?? '');
          setDraft({ ...next });
          return;
        }

        next[key] = {
          id: res.id ?? cell.id,
          value: String(amount),
        };
      }

      setErrorMsg('');
      setSaved(next);
      setDraft(next);
    });
  }

  return (
    <div className={cn('space-y-5 ', className)} dir="rtl">
      <div className="space-y-3">
        {DAY_CATEGORIES.map((day) => {
          const isOpen = !!open[day];
          return (
            <div
              key={day}
              className="overflow-hidden rounded-xl border border-border/80 bg-card/40 shadow-sm transition-shadow hover:shadow-md"
            >
              <button
                type="button"
                onClick={() => toggleDay(day)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-right text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1">{DAY_META[day].label}</span>
                <ChevronDown
                  className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
                />
              </button>

              {isOpen && (
                <div className="border-t border-border/60 bg-muted/10 px-2 pb-4 pt-1 sm:px-4 ">
                  <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                    <div className="inline-flex min-w-full gap-4 sm:gap-6 md:justify-center md:gap-8">
                      {SHIFT_ORDER.map((shift) => (
                        <div key={shift} className="flex w-full max-w-32 flex-col">
                          <span className="select-none text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {SHIFT_LABELS[shift]}
                          </span>
                          <div className="flex flex-col gap-6 rounded-lg border border-border/50  p-2 shadow-inner">
                            {positions.map((position) => (
                              <Cell
                                key={position.id}
                                day={day}
                                shift={shift}
                                position={position}
                                cell={draft[cellKey(day, shift, position.id)] ?? EMPTY_CELL}
                                onChange={handleChange}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
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
