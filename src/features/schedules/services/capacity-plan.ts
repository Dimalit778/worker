import type { EngineCapacity, ShiftType } from '@/features/scheduling-engine/types';
import { getDayCategory } from '@/features/scheduling-engine/slots';
import { canEmployeeFillPosition } from '@/features/scheduling-engine/role-eligibility';

type AssignedSlot = {
  id: string;
  date: Date;
  shiftType: ShiftType;
  positionId: string;
  slotNumber: number;
  employeeRank: number;
  positionRank: number;
  isLocked: boolean;
};

/** Keep the configured headcount and move excess staff to the closest eligible lower role. */
export function planCapacityMoves(rows: AssignedSlot[], capacities: EngineCapacity[]) {
  const moves: Array<{ id: string; positionId: string }> = [];
  const unplaced: string[] = [];
  const shifts = new Map<string, AssignedSlot[]>();
  for (const row of rows) {
    const key = `${row.date.toISOString().slice(0, 10)}|${row.shiftType}`;
    shifts.set(key, [...(shifts.get(key) ?? []), row]);
  }

  for (const shiftRows of shifts.values()) {
    const first = shiftRows[0];
    const rules = capacities.filter(rule => rule.shiftType === first.shiftType && rule.dayCategory === getDayCategory(first.date));
    const counts = new Map<string, number>();
    const extra: AssignedSlot[] = [];
    const ordered = [...shiftRows].sort((a, b) => Number(b.isLocked) - Number(a.isLocked) || a.slotNumber - b.slotNumber || a.id.localeCompare(b.id));
    for (const row of ordered) {
      const count = counts.get(row.positionId) ?? 0;
      const amount = rules.find(rule => rule.positionId === row.positionId)?.amount ?? 0;
      if (count < amount) counts.set(row.positionId, count + 1);
      else extra.push(row);
    }

    for (const row of extra.sort((a, b) => a.positionRank - b.positionRank || a.id.localeCompare(b.id))) {
      const target = [...rules]
        .filter(rule => rule.positionId !== row.positionId && rule.requiredRank > row.positionRank &&
          canEmployeeFillPosition(row.employeeRank, rule.requiredRank) && (counts.get(rule.positionId) ?? 0) < rule.amount)
        .sort((a, b) => a.requiredRank - b.requiredRank || a.positionId.localeCompare(b.positionId))[0];
      if (!target) { unplaced.push(row.id); continue; }
      counts.set(target.positionId, (counts.get(target.positionId) ?? 0) + 1);
      moves.push({ id: row.id, positionId: target.positionId });
    }
  }
  return { moves, unplaced };
}
