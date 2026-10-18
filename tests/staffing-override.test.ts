import { describe, expect, it } from 'vitest';
import {
  getCapacityForCell,
  getDateOverrideLabel,
  getRequiredForDate,
  maxSlotsForPositionInWeek,
  toDatedCapacityRules,
  type DatedCapacityRule,
} from '@/features/schedules/utils';
import { planCapacityMoves } from '@/features/schedules/services/capacity-plan';
import { validateDateOverrideInput } from '@/features/settings/date-overrides';
import type { EngineCapacity } from '@/features/scheduling-engine/types';

const guard: DatedCapacityRule = { id: 'g', positionId: 'guard', displayName: 'מאבטח', rank: 4, color: null, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 3 };
const holiday: DatedCapacityRule = { ...guard, id: 'o', amount: 1, date: '2026-10-05', label: 'סוכות' };
const added: DatedCapacityRule = { ...guard, id: 'p', positionId: 'parking', displayName: 'חניון', amount: 2, date: '2026-10-05', label: 'סוכות' };
const rules = [guard, holiday, added];

describe('date override capacity resolution', () => {
  it('uses the override on its date and the day-category rule elsewhere', () => {
    expect(getRequiredForDate(rules, '2026-10-05', 'MORNING', 'guard')).toBe(1);
    expect(getRequiredForDate(rules, '2026-10-06', 'MORNING', 'guard')).toBe(3);
    expect(getRequiredForDate(rules, '2026-10-05', 'MORNING', 'parking')).toBe(2);
    expect(getRequiredForDate(rules, '2026-10-06', 'MORNING', 'parking')).toBe(0);
  });

  it('ignores dated entries in day-category lookups (old snapshot readers)', () => {
    expect(getCapacityForCell(rules, 'WEEKDAY', 'MORNING', 'guard')).toBe(3);
    expect(getCapacityForCell(rules, 'WEEKDAY', 'MORNING', 'parking')).toBe(0);
  });

  it('sizes week rows by the largest per-date requirement', () => {
    expect(maxSlotsForPositionInWeek(rules, 'MORNING', 'parking', ['2026-10-05', '2026-10-06'])).toBe(2);
    expect(maxSlotsForPositionInWeek([guard, { ...holiday, amount: 5 }], 'MORNING', 'guard', ['2026-10-05', '2026-10-06'])).toBe(5);
  });

  it('exposes the override label for the date', () => {
    expect(getDateOverrideLabel(rules, '2026-10-05')).toBe('סוכות');
    expect(getDateOverrideLabel(rules, '2026-10-06')).toBeNull();
    expect(getDateOverrideLabel([{ ...holiday, label: null }], '2026-10-05')).toBe('תקן חריג');
  });

  it('converts override rows into dated snapshot entries', () => {
    const [entry] = toDatedCapacityRules([{
      id: 'o', date: new Date('2026-10-09T00:00:00Z'), positionId: 'guard', shiftType: 'NIGHT', requiredCount: 0, label: 'ערב חג',
      position: { name: 'מאבטח', color: '#fff', requiredRank: null, displayOrder: 9, baseRole: { rank: 4 } },
    }]);
    expect(entry).toEqual({ id: 'o', positionId: 'guard', displayName: 'מאבטח', rank: 4, color: '#fff', shiftType: 'NIGHT', dayCategory: 'FRIDAY', amount: 0, date: '2026-10-09', label: 'ערב חג' });
  });
});

describe('capacity reconciliation with overrides', () => {
  const date = new Date('2026-10-05T00:00:00Z');
  const capacities: EngineCapacity[] = [
    { positionId: 'controller', requiredRank: 3, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 1 },
    { positionId: 'guard', requiredRank: 4, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 1 },
  ];
  const row = (id: string, positionId: string, rank: number) => ({ id, date, shiftType: 'MORNING' as const, positionId, slotNumber: 1, employeeRank: rank, positionRank: rank, isLocked: false });

  it('moves staff out of a position the override lowers to 0 on that date only', () => {
    const overrides = [{ date: '2026-10-05', positionId: 'controller', requiredRank: 3, shiftType: 'MORNING' as const, amount: 0 }];
    expect(planCapacityMoves([row('c', 'controller', 3)], capacities, overrides)).toEqual({ moves: [{ id: 'c', positionId: 'guard' }], unplaced: [] });
    const other = { ...row('c', 'controller', 3), date: new Date('2026-10-06T00:00:00Z') };
    expect(planCapacityMoves([other], capacities, overrides)).toEqual({ moves: [], unplaced: [] });
  });
});

describe('date override input validation', () => {
  const allowed = new Set(['guard']);
  const valid = { date: '2026-10-20', label: '  ראש השנה ', entries: [{ positionId: 'guard', shiftType: 'MORNING' as const, amount: 2 }] };

  it('normalizes a valid form', () => {
    expect(validateDateOverrideInput(valid, '2026-10-17', allowed)).toEqual({ ok: true, value: { ...valid, label: 'ראש השנה' } });
  });

  it('rejects past dates, bad dates, unknown positions and out-of-range counts', () => {
    expect(validateDateOverrideInput({ ...valid, date: '2026-10-16' }, '2026-10-17', allowed)).toHaveProperty('error');
    expect(validateDateOverrideInput({ ...valid, date: '2026-02-30' }, '2026-01-01', allowed)).toHaveProperty('error');
    expect(validateDateOverrideInput({ ...valid, entries: [{ ...valid.entries[0], positionId: 'officer' }] }, '2026-10-17', allowed)).toHaveProperty('error');
    expect(validateDateOverrideInput({ ...valid, entries: [{ ...valid.entries[0], amount: 51 }] }, '2026-10-17', allowed)).toHaveProperty('error');
    expect(validateDateOverrideInput({ ...valid, entries: [{ ...valid.entries[0], amount: 1.5 }] }, '2026-10-17', allowed)).toHaveProperty('error');
    expect(validateDateOverrideInput({ ...valid, entries: [valid.entries[0], valid.entries[0]] }, '2026-10-17', allowed)).toHaveProperty('error');
    expect(validateDateOverrideInput({ ...valid, entries: [] }, '2026-10-17', allowed)).toHaveProperty('error');
  });

  it('accepts 0 and today', () => {
    expect(validateDateOverrideInput({ ...valid, date: '2026-10-17', entries: [{ ...valid.entries[0], amount: 0 }] }, '2026-10-17', allowed)).toHaveProperty('ok', true);
  });
});
