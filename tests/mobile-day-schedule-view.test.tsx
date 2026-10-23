// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MobileDayScheduleView } from '@/features/schedules/draft-schedule/mobile-day-schedule-view';
import type { AssignmentMap, ScheduleCapacityRule } from '@/features/schedules/types';

vi.mock('@/features/schedules/draft-schedule/assignment-cell', () => ({
  AssignmentCell: ({
    as,
    positionId,
    slotIndex,
    assignment,
  }: {
    as?: string;
    positionId: string;
    slotIndex: number;
    assignment: { employeeDisplayName: string } | null;
  }) => (
    <div data-as={as} data-position={positionId} data-slot={slotIndex}>
      {assignment?.employeeDisplayName ?? 'פנוי'}
    </div>
  ),
}));
afterEach(cleanup);

const morningManager: ScheduleCapacityRule = {
  id: 'rule-manager',
  positionId: 'manager',
  displayName: 'אחמ״ש',
  rank: 2,
  color: null,
  shiftType: 'MORNING',
  dayCategory: 'WEEKDAY',
  amount: 1,
};
const morningGuard: ScheduleCapacityRule = {
  id: 'rule-guard',
  positionId: 'guard',
  displayName: 'מאבטח',
  rank: 4,
  color: '#00ff00',
  shiftType: 'MORNING',
  dayCategory: 'WEEKDAY',
  amount: 10,
};
const eveningGuard: ScheduleCapacityRule = {
  ...morningGuard,
  id: 'rule-guard-evening',
  shiftType: 'EVENING',
  amount: 6,
};

it('shows the selected day with the desktop shift tables, rendering every required slot', () => {
  const weekDays = [{ iso: '2026-10-05', dayOfWeek: 1, letter: 'ב', label: '05/10' }];
  const capacity: ScheduleCapacityRule[] = [morningManager, morningGuard, eveningGuard];

  render(
    <MobileDayScheduleView
      weekDays={weekDays}
      assignments={{}}
      employees={[]}
      capacity={capacity}
      scheduleId="schedule"
      facilityId="facility"
    />,
  );

  // Day appears in the picker and in each shift table header.
  expect(screen.getByRole('button', { name: 'ב 05/10' })).toHaveAttribute('aria-pressed', 'true');
  // Both shift sections for this day render (morning has manager+10 guards, evening has 6 guards).
  expect(screen.getByText('בוקר')).toBeInTheDocument();
  expect(screen.getByText('ערב')).toBeInTheDocument();
  // Night has no capacity rules for this day -> it renders as the empty "no staffing" banner.
  expect(screen.getByText('אין תקנים למשמרת זו')).toBeInTheDocument();

  const rows = screen.getAllByText('פנוי');
  expect(rows).toHaveLength(1 /* manager */ + 10 /* morning guards */ + 6 /* evening guards */);
});

it('preserves every assignment through the day-first regrouping (no slot dropped or duplicated)', () => {
  const weekDays = [{ iso: '2026-10-05', dayOfWeek: 1, letter: 'ב', label: '05/10' }];
  const capacity: ScheduleCapacityRule[] = [morningGuard];
  const assignments: AssignmentMap = {
    '2026-10-05-MORNING-guard': Array.from({ length: 10 }, (_, i) => ({
      id: `a${i}`,
      employeeId: `e${i}`,
      employeeDisplayName: `עובד ${i}`,
      positionId: 'guard',
      positionName: 'מאבטח',
      shiftType: 'MORNING' as const,
      slotIndex: i,
    })),
  };

  render(
    <MobileDayScheduleView
      weekDays={weekDays}
      assignments={assignments}
      employees={[]}
      capacity={capacity}
      scheduleId="schedule"
      facilityId="facility"
    />,
  );

  for (let i = 0; i < 10; i++) {
    expect(screen.getByText(`עובד ${i}`)).toBeInTheDocument();
  }
  expect(screen.queryByText('פנוי')).not.toBeInTheDocument();
});

it('targets each row by its assignment slot, and an empty row by an unused slot, after an unsaved removal', () => {
  const weekDays = [{ iso: '2026-10-05', dayOfWeek: 1, letter: 'ב', label: '05/10' }];
  // Saved [A(0), B(1)] with A removed but not saved yet: only B(1) remains in the cell.
  const assignments: AssignmentMap = {
    '2026-10-05-MORNING-guard': [{ id: 'b', employeeId: 'b', employeeDisplayName: 'בני', positionId: 'guard', positionName: 'מאבטח', shiftType: 'MORNING', slotIndex: 1 }],
  };
  render(
    <MobileDayScheduleView weekDays={weekDays} assignments={assignments} employees={[]} capacity={[{ ...morningGuard, amount: 2 }]} scheduleId="schedule" facilityId="facility" />,
  );
  expect(screen.getByText('בני')).toHaveAttribute('data-slot', '1');
  expect(screen.getByText('פנוי')).toHaveAttribute('data-slot', '0');
});
