import { describe, expect, it } from 'vitest';
import { groupWarningsByEmployee } from '@/features/schedules/warnings-utils';
import type { ScheduleWarningSummary } from '@/features/schedules/types';

const make = (overrides: Partial<ScheduleWarningSummary>): ScheduleWarningSummary => ({
  id: 'w1',
  type: 'UNFILLED',
  severity: 'WARNING',
  message: '',
  date: '2026-05-22',
  shiftType: 'MORNING',
  employeeName: 'דוד לוי',
  positionName: 'אחמ"ש',
  ...overrides,
});

describe('groupWarningsByEmployee', () => {
  it('returns empty array for empty input', () => {
    expect(groupWarningsByEmployee([])).toEqual([]);
  });

  it('groups warnings by employeeName', () => {
    const warnings = [
      make({ id: 'w1', employeeName: 'דוד לוי', severity: 'ERROR' }),
      make({ id: 'w2', employeeName: 'דוד לוי', severity: 'WARNING' }),
      make({ id: 'w3', employeeName: 'רחל כהן', severity: 'WARNING' }),
    ];
    const result = groupWarningsByEmployee(warnings);
    expect(result).toHaveLength(2);
    expect(result.find(g => g.employeeName === 'דוד לוי')?.warnings).toHaveLength(2);
    expect(result.find(g => g.employeeName === 'רחל כהן')?.warnings).toHaveLength(1);
  });

  it('sets worstSeverity to ERROR when group has any ERROR', () => {
    const warnings = [
      make({ id: 'w1', severity: 'ERROR' }),
      make({ id: 'w2', severity: 'INFO' }),
    ];
    const [group] = groupWarningsByEmployee(warnings);
    expect(group.worstSeverity).toBe('ERROR');
  });

  it('sets worstSeverity to WARNING when no ERROR', () => {
    const warnings = [
      make({ id: 'w1', severity: 'WARNING' }),
      make({ id: 'w2', severity: 'INFO' }),
    ];
    const [group] = groupWarningsByEmployee(warnings);
    expect(group.worstSeverity).toBe('WARNING');
  });

  it('sets worstSeverity to INFO when all INFO', () => {
    const [group] = groupWarningsByEmployee([make({ severity: 'INFO' })]);
    expect(group.worstSeverity).toBe('INFO');
  });

  it('groups warnings without employeeName by positionName', () => {
    const warnings = [
      make({ employeeName: null, positionName: 'מאבטחים' }),
      make({ employeeName: 'דוד לוי', positionName: 'אחמ"ש' }),
    ];
    const result = groupWarningsByEmployee(warnings);
    expect(result).toHaveLength(2);
    expect(result.find(g => g.employeeName === 'מאבטחים')).toBeDefined();
    expect(result.find(g => g.employeeName === 'דוד לוי')).toBeDefined();
  });

  it('falls back to "כללי" when both employeeName and positionName are null', () => {
    const [group] = groupWarningsByEmployee([make({ employeeName: null, positionName: null })]);
    expect(group.employeeName).toBe('כללי');
  });

  it('sorts groups: ERROR first, then WARNING, then INFO', () => {
    const warnings = [
      make({ id: 'w1', employeeName: 'מיכאל', severity: 'INFO' }),
      make({ id: 'w2', employeeName: 'רחל', severity: 'WARNING' }),
      make({ id: 'w3', employeeName: 'דוד', severity: 'ERROR' }),
    ];
    const result = groupWarningsByEmployee(warnings);
    expect(result[0].worstSeverity).toBe('ERROR');
    expect(result[1].worstSeverity).toBe('WARNING');
    expect(result[2].worstSeverity).toBe('INFO');
  });
});
