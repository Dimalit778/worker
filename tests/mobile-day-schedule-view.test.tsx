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

it('groups by Day -> Shift -> Position, rendering every required slot as a mobile row (as="row")', () => {
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

  // Day heading present once.
  expect(screen.getByText('05/10')).toBeInTheDocument();
  // Both shift sections for this day render (morning has manager+10 guards, evening has 6 guards).
  expect(screen.getByText('בוקר')).toBeInTheDocument();
  expect(screen.getByText('ערב')).toBeInTheDocument();
  // Night has no capacity rules for this day -> its shift section must not render at all.
  expect(screen.queryByText('לילה')).not.toBeInTheDocument();

  const rows = screen.getAllByText('פנוי');
  expect(rows).toHaveLength(1 /* manager */ + 10 /* morning guards */ + 6 /* evening guards */);
  rows.forEach((row) => expect(row).toHaveAttribute('data-as', 'row'));
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
