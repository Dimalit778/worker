import { describe, expect, it } from 'vitest';
import { periodDates, prepareEmployees } from '../prisma/seed';

describe('demo seed inputs', () => {
  it('preserves all employees with unique logins and resolves legacy facility/role/phone fields', () => {
    const employees = prepareEmployees();
    expect(employees).toHaveLength(66);
    expect(new Set(employees.map(e => e.email)).size).toBe(66);
    expect(new Set(employees.map(e => e.facilityCode))).toEqual(new Set(['BAT_YAM', 'VAITZMAN', 'SHOKEN', 'RISHON']));
    expect(employees.every(e => e.roleCode && e.phoneNumber === e.phoneNumber?.trim())).toBe(true);
    expect(employees.find(e => e.email === 'tomerlevy@gmail.com')?.canEditSchedule).toBe(true);
    expect(employees.filter(e => e.email !== e.originalEmail).length).toBeGreaterThan(0);
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
