'use client';

import { useState, useTransition } from 'react';
import { addCourtShiftRule, updateCourtShiftRule, deleteCourtShiftRule } from '@/features/shifts/actions';
import type { CourtShiftRuleRow } from '@/features/shifts/types';
import { DayCategory, Position, ShiftType } from '@/generated/prisma/client';

// ─── Config ───────────────────────────────────────────────────────────────────

const DAY_ORDER: DayCategory[] = ['WEEKDAY', 'FRIDAY', 'SATURDAY', 'HOLIDAY'];

const DAY_META: Record<DayCategory, { label: string }> = {
  WEEKDAY: { label: 'ברירת מחדל (ימים א׳–ה׳)' },
  FRIDAY: { label: 'יום שישי' },
  SATURDAY: { label: 'שבת' },
  HOLIDAY: { label: 'חג' },
};

const SHIFT_ORDER: ShiftType[] = ['MORNING', 'EVENING', 'NIGHT'];

const SHIFT_LABELS: Record<ShiftType, string> = {
  MORNING: 'בוקר',
  EVENING: 'ערב',
  NIGHT: 'לילה',
};

const POSITIONS: { key: Position; label: string }[] = [
  { key: 'SHIFT_MANAGER', label: 'אחמ״ש' },
  { key: 'BAKAR', label: 'בקר' },
  { key: 'GUARD', label: 'מאבטח' },
];

// ─── State helpers ────────────────────────────────────────────────────────────

type CellKey = `${DayCategory}-${ShiftType}-${Position}`;
type CellState = { id: string | null; value: string };
type GridState = Record<CellKey, CellState>;

function cellKey(day: DayCategory, shift: ShiftType, pos: Position): CellKey {
  return `${day}-${shift}-${pos}`;
}

function buildGrid(rules: CourtShiftRuleRow[]): GridState {
  const grid: GridState = {} as GridState;
  for (const day of DAY_ORDER) {
    for (const shift of SHIFT_ORDER) {
      for (const { key: pos } of POSITIONS) {
        grid[cellKey(day, shift, pos)] = { id: null, value: '0' };
      }
    }
  }
  for (const r of rules) {
    const k = cellKey(r.dayCategory, r.shiftType, r.position);
    if (k in grid) grid[k] = { id: r.id, value: String(r.requiredCount) };
  }
  return grid;
}

// ─── Single cell input ────────────────────────────────────────────────────────

function Cell({
  day,
  shift,
  pos,
  posLabel,
  cell,
  onCommit,
}: {
  day: DayCategory;
  shift: ShiftType;
  pos: Position;
  posLabel: string;
  cell: CellState;
  onCommit: (day: DayCategory, shift: ShiftType, pos: Position, raw: string) => void;
}) {
  const [local, setLocal] = useState(cell.value);

  // keep in sync when parent state resets (e.g. after save)
  const displayed = local !== cell.value && document.activeElement === null ? cell.value : local;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">{posLabel}</span>
      <input
        type="number"
        min={0}
        max={999}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onFocus={() => setLocal(cell.value)}
        onBlur={(e) => {
          onCommit(day, shift, pos, e.target.value);
          setLocal(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setLocal(cell.value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-14 rounded-md border border-input bg-background px-2 py-1 text-sm text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={`${SHIFT_LABELS[shift]} ${posLabel}`}
      />
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function ShiftRulesManager({ initialRules }: { initialRules: CourtShiftRuleRow[] }) {
  const [grid, setGrid] = useState<GridState>(() => buildGrid(initialRules));
  const [errorMsg, setErrorMsg] = useState('');
  const [, startTransition] = useTransition();

  function handleCommit(day: DayCategory, shift: ShiftType, pos: Position, raw: string) {
    const n = parseInt(raw, 10);
    const k = cellKey(day, shift, pos);
    const cell = grid[k];
    const prev = parseInt(cell.value, 10);

    if (isNaN(n) || n === prev) return;

    startTransition(async () => {
      let res: { ok: true; id?: string } | { error: string };

      if (n > 0 && cell.id) {
        res = await updateCourtShiftRule(cell.id, n);
      } else if (n > 0 && !cell.id) {
        res = await addCourtShiftRule({ dayCategory: day, shiftType: shift, position: pos, requiredCount: n });
      } else if (n === 0 && cell.id) {
        res = await deleteCourtShiftRule(cell.id);
      } else {
        return; // n === 0 and no rule → nothing to do
      }

      if ('error' in res) {
        setErrorMsg(res.error);
        setGrid((g) => ({ ...g, [k]: { ...cell } })); // revert
      } else {
        setErrorMsg('');
        setGrid((g) => ({
          ...g,
          [k]: {
            id: 'id' in res ? (res.id ?? cell.id) : n === 0 ? null : cell.id,
            value: String(n),
          },
        }));
      }
    });
  }

  return (
    <div className="space-y-6 max-w-sm" dir="rtl">
      {DAY_ORDER.map((day) => (
        <div key={day} className="space-y-2">
          <div>
            <p className="text-sm font-semibold">{DAY_META[day].label}</p>
          </div>
          <div className="flex gap-6 pr-2">
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
                    cell={grid[cellKey(day, shift, pos)]}
                    onCommit={handleCommit}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}

      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
    </div>
  );
}
