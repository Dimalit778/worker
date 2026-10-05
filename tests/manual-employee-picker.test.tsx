// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { GuardPicker } from '@/features/schedules/shared/guard-picker';
import { blockedEmployeeIdsForShift } from '@/features/schedules/utils';
import type { AssignmentMap } from '@/features/schedules/types';
import type { ShiftType } from '@/features/scheduling-engine/types';
afterEach(cleanup);

it('lists every employee for manager selection, including employees in other roles', () => {
  const onSelect = vi.fn();
  render(<GuardPicker employees={[
    { id: 'guard', displayName: 'מאבטח לדוגמה', position: { id: 'guard-role', name: 'מאבטח', rank: 4 } },
    { id: 'manager', displayName: 'אחמש לדוגמה', position: { id: 'manager-role', name: 'אחמ״ש', rank: 2 } },
  ]} currentUserId="manager" anchorRect={{ bottom: 0, left: 0 } as DOMRect} onSelect={onSelect} onRemove={vi.fn()} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'מאבטח לדוגמה' }));
  expect(onSelect).toHaveBeenCalledWith('guard');
  expect(screen.getByRole('button', { name: 'אחמש לדוגמה' })).toBeInTheDocument();
});

const candidates = [
  { id: 'same', displayName: 'באותה משמרת', position: null },
  { id: 'before', displayName: 'במשמרת הקודמת', position: null },
  { id: 'after', displayName: 'במשמרת הבאה', position: null },
  { id: 'free', displayName: 'עובד פנוי', position: null },
];
function assignmentsFor(entries: Array<[string, string, ShiftType]>): AssignmentMap {
  return Object.fromEntries(entries.map(([employeeId, date, shiftType]) => [
    `${date}-${shiftType}-guard`, [{ id: employeeId, employeeId, employeeDisplayName: employeeId, positionId: 'guard', positionName: 'מאבטח', shiftType, slotIndex: 0 }],
  ]));
}

it.each([
  { target: 'MORNING' as const, date: '2026-10-01', previousDate: '2026-09-30', previous: 'NIGHT' as const, nextDate: '2026-10-01', next: 'EVENING' as const },
  { target: 'EVENING' as const, date: '2026-10-05', previousDate: '2026-10-05', previous: 'MORNING' as const, nextDate: '2026-10-05', next: 'NIGHT' as const },
  { target: 'NIGHT' as const, date: '2026-10-05', previousDate: '2026-10-05', previous: 'EVENING' as const, nextDate: '2026-10-06', next: 'MORNING' as const },
])('hides employees in the same, preceding and following shift for $target', ({ target, date, previousDate, previous, nextDate, next }) => {
  const assignments = assignmentsFor([
    ['same', date, target], ['before', previousDate, previous], ['after', nextDate, next],
  ]);
  const blocked = blockedEmployeeIdsForShift(assignments, date, target);
  render(<GuardPicker employees={candidates} currentUserId="same" disabledEmployeeIds={blocked}
    anchorRect={{ bottom: 0, left: 0 } as DOMRect} onSelect={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'באותה משמרת' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'במשמרת הקודמת' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'במשמרת הבאה' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'עובד פנוי' })).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('חיפוש...'), { target: { value: 'במשמרת' } });
  expect(screen.queryByRole('button', { name: 'במשמרת הקודמת' })).not.toBeInTheDocument();
});

it('shows one employee list even when swap candidates are supplied', () => {
  render(<GuardPicker employees={candidates} currentUserId="same" disabledEmployeeIds={new Set(['same', 'before', 'after'])}
    anchorRect={{ bottom: 0, left: 0 } as DOMRect} onSelect={vi.fn()} onRemove={vi.fn()} onClose={vi.fn()} onSwap={vi.fn()}
    swapCandidates={[{ assignmentId: 'other', employeeId: 'free', displayName: 'עובד פנוי' }]} />);
  expect(screen.queryByText('החלף עם...')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'עובד פנוי' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'במשמרת הבאה' })).not.toBeInTheDocument();
});
