'use client';

import { useState, useTransition } from 'react';
import { addCourtShiftRule, updateCourtShiftRule, deleteCourtShiftRule } from '@/features/court-settings/actions';
import type { CourtShiftRoleRow } from '@/features/court-settings/types';
import { DayCategory, Position, ShiftType } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';
import { DAY_ORDER, DAY_META, SHIFT_ORDER, SHIFT_LABELS, POSITIONS } from '@/features/court-settings/constans';

type CellKey = `${DayCategory}-${ShiftType}-${Position}`;
type CellState = { id: string | null; value: string };
type GridState = Record<CellKey, CellState>;

function cellKey(day: DayCategory, shift: ShiftType, pos: Position): CellKey {
  return `${day}-${shift}-${pos}`;
}

function buildGrid(_roles: CourtShiftRoleRow[]): GridState {
  const grid: GridState = {} as GridState;
  for (const day of DAY_ORDER) {
    for (const shift of SHIFT_ORDER) {
      for (const { key: pos } of POSITIONS) {
        grid[cellKey(day, shift, pos)] = { id: null, value: '0' };
      }
    }
  }
  return grid;
}

function Cell({
  day,
  shift,
  pos,
  posLabel,
  cell,
  onChange,
}: {
  day: DayCategory;
  shift: ShiftType;
  pos: Position;
  posLabel: string;
  cell: CellState;
  onChange: (day: DayCategory, shift: ShiftType, pos: Position, raw: string) => void;
}) {
  const [local, setLocal] = useState(cell.value);

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">{posLabel}</span>
      <input
        type="number"
        min={0}
        max={50}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onFocus={() => setLocal(cell.value)}
        onBlur={(e) => {
          onChange(day, shift, pos, e.target.value);
          setLocal(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setLocal(cell.value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-14 rounded-md border border-input bg-background px-2 py-1 text-sm text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        aria-label={`${SHIFT_LABELS[shift]} ${posLabel}`}
      />
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function ShiftRulesManager({ initialRoles }: { initialRoles: CourtShiftRoleRow[] }) {
  const initial = buildGrid(initialRoles);
  const [draft, setDraft] = useState<GridState>(initial);
  const [saved, setSaved] = useState<GridState>(initial);
  const [newRules, setNewRules] = useState<
    Partial<Record<DayCategory, { shift: ShiftType; pos: Position; count: number }>>
  >({});
  const [errorMsg, setErrorMsg] = useState('');
  const [open, setOpen] = useState<Partial<Record<DayCategory, boolean>>>({});
  const [isPending, startTransition] = useTransition();

  const isDirty = (Object.keys(draft) as CellKey[]).some(
    (k) => draft[k].value !== saved[k].value,
  );

  function toggleDay(day: DayCategory) {
    setOpen((prev) => ({ ...prev, [day]: !prev[day] }));
  }

  function handleChange(day: DayCategory, shift: ShiftType, pos: Position, raw: string) {
    const k = cellKey(day, shift, pos);
    setDraft((g) => ({ ...g, [k]: { ...g[k], value: raw } }));
  }

  function handleSaveAll() {
    startTransition(async () => {
      const dirtyKeys = (Object.keys(draft) as CellKey[]).filter(
        (k) => draft[k].value !== saved[k].value,
      );

      const next = { ...saved };

      for (const k of dirtyKeys) {
        const n = parseInt(draft[k].value, 10);
        const cell = saved[k];
        const [day, shift, pos] = k.split('-') as [DayCategory, ShiftType, Position];

        let res: { ok: true; id?: string } | { error: string };

        if (n > 0 && cell.id) {
          res = await updateCourtShiftRule(cell.id, n);
        } else if (n > 0 && !cell.id) {
          res = await addCourtShiftRule(shift, day, pos, n);
        } else if (n === 0 && cell.id) {
          res = await deleteCourtShiftRule(cell.id);
        } else {
          next[k] = { id: null, value: '0' };
          continue;
        }

        if ('error' in res) {
          setErrorMsg(res.error);
          setDraft({ ...next }); // revert to last successful state
          return;
        }

        next[k] = {
          id: n > 0 ? ((res as { ok: true; id?: string }).id ?? cell.id) : null,
          value: String(n),
        };
      }

      setErrorMsg('');
      setSaved(next);
      setDraft(next);
    });
  }

  function handleAddRule(day: DayCategory, shift: ShiftType, pos: Position, count: number) {
    if (count <= 0) return;

    startTransition(async () => {
      const res = await addCourtShiftRule(shift, day, pos, count);

      if ('error' in res) {
        setErrorMsg(res.error);
      } else {
        setErrorMsg('');
        const k = cellKey(day, shift, pos);
        const updated = { id: res.id, value: String(count) };
        setSaved((g) => ({ ...g, [k]: updated }));
        setDraft((g) => ({ ...g, [k]: updated }));
        setNewRules((prev) => ({ ...prev, [day]: undefined }));
      }
    });
  }

  return (
    <div className="space-y-6 max-w-sm" dir="rtl">
      {DAY_ORDER.map((day) => {
        const isOpen = !!open[day];
        return (
          <div key={day} className="space-y-2">
            <button
              type="button"
              onClick={() => toggleDay(day)}
              className="flex items-center gap-2 w-full rounded-md bg-muted px-3 py-2 text-sm font-semibold hover:bg-muted/70 transition-colors"
            >
              <span className="text-muted-foreground">{isOpen ? '▼' : '◀'}</span>
              <span>{DAY_META[day].label}</span>
            </button>

            {isOpen && (
              <div>
                <div className="flex gap-6 pr-2 pt-1">
                  {SHIFT_ORDER.map((shift) => (
                    <div key={shift} className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-center">{SHIFT_LABELS[shift]}</span>
                      {POSITIONS.map(({ key: pos, label }) => (
                        <Cell
                          key={pos}
                          day={day}
                          shift={shift}
                          pos={pos}
                          posLabel={label}
                          cell={draft[cellKey(day, shift, pos)]}
                          onChange={handleChange}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                {/* new rule form */}
                <div className="flex items-center gap-2 pt-2">
                  <select
                    value={newRules[day]?.pos ?? 'GUARD'}
                    onChange={(e) =>
                      setNewRules((prev) => ({
                        ...prev,
                        [day]: { shift: 'MORNING', count: 0, ...prev[day], pos: e.target.value as Position },
                      }))
                    }
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {POSITIONS.map(({ key, label }) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newRules[day]?.shift ?? 'MORNING'}
                    onChange={(e) =>
                      setNewRules((prev) => ({
                        ...prev,
                        [day]: { pos: 'GUARD', count: 0, ...prev[day], shift: e.target.value as ShiftType },
                      }))
                    }
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {SHIFT_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {SHIFT_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={newRules[day]?.count ?? 0}
                    onChange={(e) =>
                      setNewRules((prev) => ({
                        ...prev,
                        [day]: { shift: 'MORNING', pos: 'GUARD', ...prev[day], count: Number(e.target.value) },
                      }))
                    }
                    className="w-14 rounded-md border border-input bg-background px-2 py-1 text-sm text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const nr = newRules[day];
                      handleAddRule(day, nr?.shift ?? 'MORNING', nr?.pos ?? 'GUARD', nr?.count ?? 0);
                    }}
                  >
                    שמור
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}

      {isDirty && (
        <div className="sticky bottom-4 flex justify-start">
          <Button
            type="button"
            onClick={handleSaveAll}
            disabled={isPending}
            className="shadow-md"
          >
            {isPending ? 'שומר...' : 'שמור שינויים'}
          </Button>
        </div>
      )}
    </div>
  );
}
