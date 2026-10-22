import { describe, expect, it } from 'vitest';
import { createMandatoryStaffingWarnings } from '../warnings';
import type { EngineAssignment, EngineSlot } from '../types';

const date = new Date('2098-01-06T00:00:00Z');
const POSITIONS = { ahmash: { name: 'אחמ״ש', rank: 2 }, bakar: { name: 'בקר', rank: 3 }, guard: { name: 'מאבטח', rank: 4 } };
type PositionId = keyof typeof POSITIONS;

const slot = (positionId: PositionId, mandatoryAmount: number, requiredAmount = 5): EngineSlot => ({
  facilityId: 'court', positionId, positionName: POSITIONS[positionId].name, requiredRank: POSITIONS[positionId].rank,
  date, shiftType: 'NIGHT', dayCategory: 'WEEKDAY', requiredAmount, mandatoryAmount,
});

const assigned = (positionId: PositionId, count: number): EngineAssignment[] =>
  Array.from({ length: count }, (_, i) => ({
    employeeId: `${positionId}-${i}`, facilityId: 'court', positionId, date, shiftType: 'NIGHT' as const, slotIndex: i, isManualOverride: false,
  }));

const shortages = (slots: EngineSlot[], assignments: EngineAssignment[]) =>
  createMandatoryStaffingWarnings(slots, assignments).map(w => w.message.split(' — ')[1]);

describe('mandatory staffing warnings', () => {
  it('lets a more senior position cover a junior mandatory count', () => {
    const slots = [slot('ahmash', 0), slot('bakar', 0), slot('guard', 1)];
    expect(shortages(slots, assigned('ahmash', 1))).toEqual([]);
    expect(shortages(slots, assigned('bakar', 1))).toEqual([]);
  });

  it('does not let a junior position cover a senior mandatory count', () => {
    const slots = [slot('ahmash', 0), slot('bakar', 1), slot('guard', 0)];
    expect(shortages(slots, assigned('guard', 2))).toEqual(['בקר: משובצים 0 מתוך 1 בחובה.']);
    expect(shortages(slots, assigned('ahmash', 1))).toEqual([]);
  });

  it('counts each person once', () => {
    const slots = [slot('ahmash', 1), slot('bakar', 0), slot('guard', 1)];
    expect(shortages(slots, assigned('ahmash', 1))).toEqual(['מאבטח: משובצים 0 מתוך 1 בחובה.']);
    expect(shortages(slots, assigned('ahmash', 2))).toEqual([]);
  });

  it('uses spare seniors toward a partially staffed junior position', () => {
    const slots = [slot('ahmash', 1), slot('bakar', 0), slot('guard', 3)];
    expect(shortages(slots, [...assigned('ahmash', 2), ...assigned('guard', 2)])).toEqual([]);
    expect(shortages(slots, [...assigned('ahmash', 1), ...assigned('guard', 2)])).toEqual(['מאבטח: משובצים 2 מתוך 3 בחובה.']);
  });
});
