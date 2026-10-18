// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ShiftSection } from '@/features/schedules/draft-schedule/shift-section';
import type { DatedCapacityRule } from '@/features/schedules/utils';

vi.mock('@/features/schedules/draft-schedule/assignment-cell', () => ({
  AssignmentCell: ({ closed, positionId, date }: { closed: boolean; positionId: string; date: string }) => (
    <td data-position={positionId} data-date={date}>{closed ? 'סגור' : 'פנוי'}</td>
  ),
}));
afterEach(cleanup);

const days = [
  { iso: '2026-10-05', dayOfWeek: 1, letter: 'ב', label: '05/10' },
  { iso: '2026-10-06', dayOfWeek: 2, letter: 'ג', label: '06/10' },
];
const guard: DatedCapacityRule = { id: 'g', positionId: 'guard', displayName: 'מאבטח', rank: 4, color: null, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 1 };

it('opens extra override slots on the holiday date and shows its label', () => {
  const capacity: DatedCapacityRule[] = [guard, { ...guard, id: 'o', amount: 2, date: '2026-10-05', label: 'סוכות' }];
  render(<ShiftSection shiftType="MORNING" weekDays={days} assignments={{}} employees={[]} capacity={capacity} scheduleId="s" facilityId="f" readonly />);
  expect(screen.getByText('סוכות')).toBeInTheDocument();
  const rows = screen.getAllByRole('row');
  expect(rows).toHaveLength(3); // header + two guard rows (max of 2 on the holiday)
  const second = rows[2].querySelectorAll('td[data-date]');
  expect(second[0]).toHaveTextContent('פנוי'); // holiday: second slot open
  expect(second[1]).toHaveTextContent('סגור'); // regular day: only one slot
});
