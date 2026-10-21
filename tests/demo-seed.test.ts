import { describe, expect, it } from 'vitest';
import type { EngineInput } from '../src/features/scheduling-engine/types';
import { validateAssignments } from '../src/features/scheduling-engine/validate';
import { DEMO_STAFFING, generateDemoAssignments, periodDates, prepareEmployees } from '../prisma/seed';

describe('demo seed inputs', () => {
  it('imports only Bat Yam and Shoken employees by their own facility code', () => {
    const employees = prepareEmployees();
    expect(employees).toHaveLength(30);
    expect(new Set(employees.map(e => e.email)).size).toBe(30);
    expect(new Set(employees.map(e => e.facilityCode))).toEqual(new Set(['BAT_YAM', 'SHOKEN']));
    expect(employees.every(e => e.roleCode && e.phoneNumber === e.phoneNumber?.trim())).toBe(true);
    expect(employees.find(e => e.email === 'tomerlevy@gmail.com')?.canEditSchedule).toBe(true);
    expect(employees.filter(e => e.facilityCode === 'BAT_YAM')).toHaveLength(21);
    expect(employees.filter(e => e.facilityCode === 'SHOKEN')).toHaveLength(9);
    expect(employees.some(e => e.email === 'orshimoni@gmail.com')).toBe(false);
  });

  it('avoids collisions even when a generated alias is already present', () => {
    const base = { firstName: 'א', lastName: 'ב', displayName: 'א', facilityCode: 'BAT_YAM', roleCode: 'GUARD', password: 'demo' };
    const employees = prepareEmployees({ demo: [
      { ...base, email: 'demo@example.test' },
      { ...base, email: 'demo+bat_yam@example.test' },
      { ...base, email: 'demo@example.test' },
    ] });
    expect(employees[2].email).toBe('demo+bat_yam2@example.test');
  });

  it('accepts exactly one or two inclusive weeks across months and years', () => {
    expect(periodDates('2026-12-28', '2027-01-03')).toHaveLength(7);
    expect(periodDates('2026-12-28', '2027-01-10')).toHaveLength(14);
  });

  it.each([
    ['2026-02-30', '2026-03-08'], ['21/10/2026', '2026-10-27'],
    ['2026-10-21', '2026-10-20'], ['2026-10-21', '2026-10-28'],
  ])('rejects invalid dates/lengths before deleting anything (%s, %s)', (start, end) => {
    expect(() => periodDates(start, end)).toThrow();
  });
});


describe('demo staffing and weekly assignments', () => {
  it('uses the exact requested morning/evening/night counts for each day category', () => {
    expect(DEMO_STAFFING).toEqual({
      BAT_YAM: {
        WEEKDAY: { MORNING: [1, 1, 13], EVENING: [1, 1, 4], NIGHT: [1, 0, 2] },
        FRIDAY: { MORNING: [1, 0, 3], EVENING: [0, 0, 2], NIGHT: [0, 0, 3] },
        SATURDAY: { MORNING: [0, 0, 2], EVENING: [0, 0, 2], NIGHT: [0, 0, 3] },
      },
      SHOKEN: {
        WEEKDAY: { MORNING: [1, 0, 8], EVENING: [1, 0, 3], NIGHT: [0, 0, 2] },
        FRIDAY: { MORNING: [1, 0, 3], EVENING: [0, 0, 2], NIGHT: [0, 0, 2] },
        SATURDAY: { MORNING: [0, 0, 2], EVENING: [0, 0, 2], NIGHT: [0, 0, 2] },
      },
    });
  });
});


it.each([7, 14])('preserves weekly minimums with up to two extras and hard constraints for %i days', days => {
  const dates = periodDates('2026-10-18', days === 7 ? '2026-10-24' : '2026-10-31');
  for (const facilityId of ['BAT_YAM', 'SHOKEN'] as const) {
    const employees = prepareEmployees().filter(e => e.facilityCode === facilityId).map(e => {
      const rank = ({ MANAGER: 1, SHIFT_MANAGER: 2, BAKAR: 3, GUARD: 4 })[e.roleCode]!;
      return { id: e.email, facilityId, rank, positionId: String(rank), isActive: true };
    });
    const capacities: EngineInput['capacities'] = [];
    for (const dayCategory of ['WEEKDAY', 'FRIDAY', 'SATURDAY'] as const) {
      for (const shiftType of ['MORNING', 'EVENING', 'NIGHT'] as const) {
        DEMO_STAFFING[facilityId][dayCategory][shiftType].forEach((amount, index) => {
          capacities.push({ positionId: String(index + 2), requiredRank: index + 2, shiftType, dayCategory, amount });
        });
      }
    }
    const input: EngineInput = {
      period: { id: 'demo', facilityId, startDate: dates[0], endDate: dates[dates.length - 1] },
      scheduleId: 'demo', week1Dates: dates.slice(0, 7), week2Dates: dates.slice(7), employees, capacities,
      availability: new Map(employees.map(e => [e.id, new Set(dates.flatMap(date =>
        ['MORNING', 'EVENING', 'NIGHT'].map(shift => `${date.toISOString().slice(0, 10)}|${shift}`)))])),
      manualAssignments: [],
    };
    const result = generateDemoAssignments(input);
    const staff = employees.filter(employee => employee.rank !== 1);
    const officers = new Set(employees.filter(employee => employee.rank === 1).map(employee => employee.id));
    expect(result.assignments.some(assignment => officers.has(assignment.employeeId))).toBe(false);
    // Saving loads only staff: seeded assignments must still validate with that same employee list.
    expect(validateAssignments({ ...input, employees: staff }, result.assignments, { allowManualOverrides: false })).toEqual([]);
    expect(result.warnings.filter(w => w.type === 'MIN_NOT_MET')).toEqual([]);
    for (const employee of staff) for (const week of [input.week1Dates, input.week2Dates]) {
      if (!week.length) continue;
      const times = new Set(week.map(d => d.getTime()));
      const assignments = result.assignments.filter(a => a.employeeId === employee.id && times.has(a.date.getTime()));
      expect(assignments.filter(a => a.shiftType === 'MORNING').length).toBeGreaterThanOrEqual(2);
      expect(assignments.filter(a => a.shiftType === 'EVENING').length).toBeGreaterThanOrEqual(1);
      expect(assignments.length).toBeGreaterThan(3);
      expect(assignments.length).toBeLessThanOrEqual(5);
    }
  }
}, 120000);
