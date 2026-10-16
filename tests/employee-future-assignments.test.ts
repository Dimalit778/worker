import { describe, expect, it } from 'vitest';
import { toFutureAssignments } from '@/features/employess/utils';

const row = (id: string, startsAt: string, status = 'PUBLISHED') => ({
  id,
  date: new Date(startsAt.slice(0, 10) + 'T00:00:00Z'),
  startsAt: new Date(startsAt),
  shiftType: 'MORNING',
  position: { name: 'בקר' },
  schedule: { name: 'תקופה' },
  version: { status },
});

describe('toFutureAssignments', () => {
  it('sorts by start time and maps fields', () => {
    const result = toFutureAssignments([row('b', '2030-01-02T04:00:00Z'), row('a', '2030-01-01T04:00:00Z', 'DRAFT')]);
    expect(result.map((r) => r.slotId)).toEqual(['a', 'b']);
    expect(result[0]).toMatchObject({ date: '2030-01-01', positionName: 'בקר', versionStatus: 'DRAFT' });
    expect(result[1].versionStatus).toBe('PUBLISHED');
  });

  it('returns empty list for no slots', () => {
    expect(toFutureAssignments([])).toEqual([]);
  });
});
