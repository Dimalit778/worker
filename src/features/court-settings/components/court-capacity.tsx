'use client';

import { useLayoutEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DayCategory, ShiftType } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DAY_CATEGORIES, DAY_META, SHIFT_ORDER, SHIFT_LABELS } from '@/features/court-settings/constans';
import { addShiftCapacity, updateShiftCapacity } from '@/features/court-settings/actions';
import { AddPositionModal } from './add-position-modal';
import { PositionOrderSection } from './position-order-section';

type PositionOption = {
  id: string;
  name: string;
  displayOrder: number;
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
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">{position.name}</span>

      <input
        type="number"
        min={0}
        max={50}
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
        className="w-14 rounded-md border border-input bg-background px-2 py-1 text-center text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label={`${SHIFT_LABELS[shift]} ${position.name}`}
      />
    </div>
  );
}

export function CourtCapacityRules({
  positions,
  initialCapacities,
}: {
  positions: PositionOption[];
  initialCapacities: ShiftCapacityRow[];
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
  const [open, setOpen] = useState<Partial<Record<DayCategory, boolean>>>({});
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
    <div className="w-full max-w-2xl space-y-6" dir="rtl">
      <PositionOrderSection positions={positions} />

      <div className="max-w-sm space-y-2">
        <h3 className="text-base font-semibold">קיבולת משמרות</h3>
        <p className="text-sm text-muted-foreground">הגדר מספרים לפי יום, משמרת ותפקיד. להוספת תפקיד עם קיבולת ראשונית:</p>
        <Button type="button" variant="outline" onClick={() => setAddModalOpen(true)}>
          הוסף תפקיד (עם קיבולת)
        </Button>
      </div>

      <AddPositionModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />

      <div className="max-w-sm space-y-6">
        {DAY_CATEGORIES.map((day) => {
          const isOpen = !!open[day];

          return (
            <div key={day} className="space-y-2">
              <button
                type="button"
                onClick={() => toggleDay(day)}
                className="flex w-full items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted/70"
              >
                <span className="text-muted-foreground">{isOpen ? '▼' : '◀'}</span>
                <span>{DAY_META[day].label}</span>
              </button>

              {isOpen && (
                <div className="flex gap-6 pr-2 pt-1">
                  {SHIFT_ORDER.map((shift) => (
                    <div key={shift} className="flex flex-col gap-2">
                      <span className="text-center text-sm font-medium">{SHIFT_LABELS[shift]}</span>

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
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

        {isDirty && (
          <div className="sticky bottom-4 flex justify-start">
            <Button type="button" onClick={handleSaveAll} disabled={isPending} className="shadow-md">
              {isPending ? 'שומר...' : 'שמור שינויים'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
