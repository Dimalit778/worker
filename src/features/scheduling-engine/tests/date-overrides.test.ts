import { describe, expect, it } from 'vitest';
import { buildSlots, resolveRequirementsForDate } from '../slots';
import { generateSchedule } from '../generate-schedule';
import { validateAssignments } from '../validate';
import { createMandatoryStaffingWarnings } from '../warnings';
import type { EngineCapacity, EngineDateOverride, EngineInput } from '../types';

const monday = new Date('2098-01-06T00:00:00Z');
const nextDay = new Date('2098-01-07T00:00:00Z');
const capacities: EngineCapacity[] = [
  { positionId: 'guard', positionName: 'מאבטח', requiredRank: 4, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 2 },
  { positionId: 'ahmash', positionName: 'אחמ״ש', requiredRank: 2, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 1 },
];
const override = (positionId: string, amount: number, extra: Partial<EngineDateOverride> = {}): EngineDateOverride => ({
  date: '2098-01-06', positionId, positionName: positionId === 'guard' ? 'מאבטח' : positionId, requiredRank: 4, shiftType: 'MORNING', amount, ...extra,
});

function input(dateOverrides: EngineDateOverride[] = []): EngineInput {
  const ids = ['e1', 'e2', 'e3', 'e4', 'e5'];
  return {
    scheduleId: 's',
    period: { id: 'p', facilityId: 'court', startDate: monday, endDate: nextDay },
    week1Dates: [monday, nextDay],
    week2Dates: [],
    employees: ids.map(id => ({ id, facilityId: 'court', positionId: 'role', rank: 4, isActive: true })),
    availability: new Map(ids.map(id => [id, new Set(['2098-01-06|MORNING', '2098-01-07|MORNING'])])),
    capacities,
    dateOverrides,
    manualAssignments: [],
  };
}

const amountOf = (data: EngineInput, date: Date, positionId: string) =>
  buildSlots(data).find(slot => slot.date.getTime() === date.getTime() && slot.positionId === positionId)?.requiredAmount ?? 0;

describe('date-specific staffing overrides', () => {
  it('replaces only the matching date, shift and position', () => {
    const resolved = resolveRequirementsForDate(capacities, [override('guard', 4)], monday);
    expect(resolved.find(r => r.positionId === 'guard')).toMatchObject({ amount: 4, isDateOverride: true });
    expect(resolved.find(r => r.positionId === 'ahmash')).toMatchObject({ amount: 1, isDateOverride: false });
  });

  it('raises the required count and the engine fills it', () => {
    const data = input([override('guard', 4)]);
    expect(amountOf(data, monday, 'guard')).toBe(4);
    const output = generateSchedule(data);
    expect(output.assignments.filter(a => a.positionId === 'guard' && a.date.getTime() === monday.getTime())).toHaveLength(4);
    expect(validateAssignments(data, output.assignments)).toEqual([]);
  });

  it('lowers a position to 0 so no slot is created', () => {
    const data = input([override('guard', 0)]);
    expect(amountOf(data, monday, 'guard')).toBe(0);
    expect(generateSchedule(data).assignments.some(a => a.positionId === 'guard' && a.date.getTime() === monday.getTime())).toBe(false);
  });

  it('adds a position that has no regular requirement', () => {
    const data = input([override('parking', 1, { positionName: 'חניון' })]);
    expect(amountOf(data, monday, 'parking')).toBe(1);
    const output = generateSchedule(data);
    const parking = output.assignments.filter(a => a.positionId === 'parking');
    expect(parking).toHaveLength(1);
    expect(validateAssignments(data, output.assignments)).toEqual([]);
  });

  it('leaves other dates on their day-category requirement', () => {
    const data = input([override('guard', 4), override('parking', 1)]);
    expect(amountOf(data, nextDay, 'guard')).toBe(2);
    expect(amountOf(data, nextDay, 'parking')).toBe(0);
  });

  it('caps the day-category mandatory count by the override on that date', () => {
    const data = { ...input([override('guard', 1), override('ahmash', 0, { positionName: 'אחמ״ש', requiredRank: 2 })]), capacities: capacities.map(c => ({ ...c, mandatory: c.amount })) };
    const slots = buildSlots(data);
    const mondaySlot = (positionId: string) => slots.find(slot => slot.date.getTime() === monday.getTime() && slot.positionId === positionId);
    expect(mondaySlot('guard')?.mandatoryAmount).toBe(1);
    expect(mondaySlot('ahmash')).toBeUndefined();
    const assignments = [{ employeeId: 'e1', facilityId: 'court', positionId: 'guard', positionName: 'מאבטח', date: monday, shiftType: 'MORNING' as const, slotIndex: 0, isManualOverride: false }];
    const messages = createMandatoryStaffingWarnings(slots, assignments).map(w => w.message);
    expect(messages.some(m => m.startsWith('06/01/2098'))).toBe(false);
    expect(messages).toContain('07/01/2098 · בוקר — מאבטח: משובצים 0 מתוך 2 בחובה.');
  });
});
