// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ShiftSection } from '@/features/schedules/draft-schedule/shift-section';
import type { AssignmentMap, ScheduleCapacityRule } from '@/features/schedules/types';

vi.mock('@/features/schedules/draft-schedule/assignment-cell', () => ({
  AssignmentCell: ({ closed, assignment, positionId, slotIndex, positionColor }: { closed: boolean; assignment: { employeeDisplayName: string } | null; positionId: string; slotIndex: number; positionColor: string | null }) => <td data-position={positionId} data-slot={slotIndex} data-color={positionColor}>{closed ? 'סגור' : assignment?.employeeDisplayName ?? 'פנוי'}</td>,
}));
afterEach(cleanup);
const rule: ScheduleCapacityRule = { id: 'rule', positionId: 'manager', displayName: 'אחמ״ש', rank: 2, color: null, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 1 };

it('keeps legacy assignment rows and marks slots beyond configured capacity closed', () => {
  const assignment = { id: 'first', employeeId: 'first', employeeDisplayName: 'ראשון', positionId: 'manager', positionName: 'אחמ״ש', shiftType: 'MORNING' as const, slotIndex: 0 };
  const assignments: AssignmentMap = { '2026-10-05-MORNING-manager': [assignment, { ...assignment, id: 'second', employeeId: 'second', employeeDisplayName: 'שני', slotIndex: 1 }] };
  render(<ShiftSection shiftType="MORNING" weekDays={[{ iso: '2026-10-05', dayOfWeek: 1, letter: 'ב', label: '05/10' }]} assignments={assignments} employees={[]} capacity={[rule]} scheduleId="schedule" facilityId="facility" readonly />);
  expect(document.querySelectorAll('tbody tr')).toHaveLength(2); // rows follow legacy assignments
  expect(screen.getByText('סגור')).toBeInTheDocument();
  expect(screen.getByText('ראשון')).toBeInTheDocument();
});

const weekendDays = [
  { iso: '2026-10-08', dayOfWeek: 4, letter: 'ה', label: '08/10' },
  { iso: '2026-10-09', dayOfWeek: 5, letter: 'ו', label: '09/10' },
  { iso: '2026-10-10', dayOfWeek: 6, letter: 'ש', label: '10/10' },
];
const baseRules: ScheduleCapacityRule[] = [
  rule,
  { ...rule, id: 'controller', positionId: 'controller', displayName: 'בקר', rank: 3, color: '#0000ff' },
  { ...rule, id: 'guard', positionId: 'guard', displayName: 'מאבטח', rank: 4, amount: 3, color: '#00ff00' },
];

it('packs Friday and Saturday guard slots at the top without changing weekday role alignment', () => {
  const capacity: ScheduleCapacityRule[] = [
    ...baseRules,
    { ...baseRules[2], id: 'friday-guard', dayCategory: 'FRIDAY', amount: 2 },
    { ...baseRules[2], id: 'saturday-guard', dayCategory: 'SATURDAY', amount: 1 },
  ];
  render(<ShiftSection shiftType="MORNING" weekDays={weekendDays} assignments={{}} employees={[]} capacity={capacity} scheduleId="schedule" facilityId="facility" />);
  const rows = document.querySelectorAll('tbody tr');
  const first = rows[0].querySelectorAll('td');
  expect(first[1]).toHaveAttribute('data-position', 'manager'); // Thursday retains the manager row
  expect(first[2]).toHaveAttribute('data-position', 'guard');
  expect(first[2]).toHaveAttribute('data-slot', '0');
  expect(first[2]).toHaveAttribute('data-color', '#00ff00');
  expect(first[3]).toHaveAttribute('data-position', 'guard');
  const second = rows[1].querySelectorAll('td');
  expect(second[1]).toHaveAttribute('data-position', 'controller');
  expect(second[2]).toHaveAttribute('data-position', 'guard');
  expect(second[2]).toHaveAttribute('data-slot', '1');
  expect(second[3]).toHaveAttribute('rowspan', '4'); // one blank area below Saturday's only slot
  expect(rows[2].querySelector('td[rowspan="3"]')).toBeInTheDocument(); // same for Friday after two slots
  expect(screen.queryByText('מאבטח')).not.toBeInTheDocument();
});

it('keeps configured role colors and order for a weekend with controller and guard positions', () => {
  const capacity: ScheduleCapacityRule[] = [
    ...baseRules,
    { ...baseRules[1], id: 'friday-controller', dayCategory: 'FRIDAY' },
    { ...baseRules[2], id: 'friday-guard', dayCategory: 'FRIDAY', amount: 1 },
  ];
  render(<ShiftSection shiftType="MORNING" weekDays={weekendDays} assignments={{}} employees={[]} capacity={capacity} scheduleId="schedule" facilityId="facility" />);
  const rows = document.querySelectorAll('tbody tr');
  const first = rows[0].querySelectorAll('td');
  expect(first[2]).toHaveAttribute('data-position', 'controller');
  expect(first[2]).toHaveAttribute('data-color', '#0000ff');
  expect(first[3]).toHaveAttribute('rowspan', '5'); // Saturday has no requirements
  const second = rows[1].querySelectorAll('td');
  expect(second[2]).toHaveAttribute('data-position', 'guard');
  expect(second[2]).toHaveAttribute('data-slot', '0');
});

it('holds up at realistic density (10 morning guards, 6 evening guards, multiple positions, night shift) without hiding or misaligning any assignment', () => {
  const day = { iso: '2026-10-05', dayOfWeek: 1, letter: 'ב', label: '05/10' };
  const manager: ScheduleCapacityRule = { id: 'r-manager', positionId: 'manager', displayName: 'אחמ״ש', rank: 1, color: null, shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 1 };
  const controller: ScheduleCapacityRule = { id: 'r-controller', positionId: 'controller', displayName: 'בקר', rank: 2, color: '#0000ff', shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 2 };
  const morningGuard: ScheduleCapacityRule = { id: 'r-guard-morning', positionId: 'guard', displayName: 'מאבטח', rank: 4, color: '#00ff00', shiftType: 'MORNING', dayCategory: 'WEEKDAY', amount: 10 };
  const eveningGuard: ScheduleCapacityRule = { ...morningGuard, id: 'r-guard-evening', shiftType: 'EVENING', amount: 6 };
  const nightGuard: ScheduleCapacityRule = { ...morningGuard, id: 'r-guard-night', shiftType: 'NIGHT', amount: 2 };
  const capacity = [manager, controller, morningGuard, eveningGuard, nightGuard];

  function assignedSlots(positionId: string, shiftType: 'MORNING' | 'EVENING' | 'NIGHT', count: number): AssignmentMap {
    return {
      [`${day.iso}-${shiftType}-${positionId}`]: Array.from({ length: count }, (_, i) => ({
        id: `${shiftType}-${positionId}-${i}`,
        employeeId: `${shiftType}-${positionId}-${i}`,
        employeeDisplayName: `${shiftType}-${positionId}-${i}`,
        positionId,
        positionName: positionId,
        shiftType,
        slotIndex: i,
      })),
    };
  }

  const morningAssignments = { ...assignedSlots('manager', 'MORNING', 1), ...assignedSlots('controller', 'MORNING', 2), ...assignedSlots('guard', 'MORNING', 10) };
  const { unmount: unmountMorning } = render(
    <ShiftSection shiftType="MORNING" weekDays={[day]} assignments={morningAssignments} employees={[]} capacity={capacity} scheduleId="schedule" facilityId="facility" readonly />,
  );
  // 1 manager row + 2 controller rows + 10 guard rows = 13 body rows, every slot filled, none closed.
  expect(document.querySelectorAll('tbody tr')).toHaveLength(13);
  for (let i = 0; i < 10; i++) expect(screen.getByText(`MORNING-guard-${i}`)).toBeInTheDocument();
  expect(screen.getByText('MORNING-manager-0')).toBeInTheDocument();
  expect(screen.getByText('MORNING-controller-0')).toBeInTheDocument();
  expect(screen.getByText('MORNING-controller-1')).toBeInTheDocument();
  expect(screen.queryByText('סגור')).not.toBeInTheDocument();
  unmountMorning();

  const eveningAssignments = assignedSlots('guard', 'EVENING', 6);
  const { unmount: unmountEvening } = render(
    <ShiftSection shiftType="EVENING" weekDays={[day]} assignments={eveningAssignments} employees={[]} capacity={capacity} scheduleId="schedule" facilityId="facility" readonly />,
  );
  expect(document.querySelectorAll('tbody tr')).toHaveLength(6); // manager/controller have no EVENING rule -> 6 guard rows only
  for (let i = 0; i < 6; i++) expect(screen.getByText(`EVENING-guard-${i}`)).toBeInTheDocument();
  unmountEvening();

  const nightAssignments = assignedSlots('guard', 'NIGHT', 1); // one slot filled, one open
  render(
    <ShiftSection shiftType="NIGHT" weekDays={[day]} assignments={nightAssignments} employees={[]} capacity={capacity} scheduleId="schedule" facilityId="facility" />,
  );
  expect(document.querySelectorAll('tbody tr')).toHaveLength(2); // every required slot gets a row, the open one stays empty
  expect(screen.getByText('NIGHT-guard-0')).toBeInTheDocument();
  expect(screen.getAllByText('פנוי')).toHaveLength(1);
});

it('gives an empty row a slot index no shown assignment uses, after an unsaved removal leaves a gap', () => {
  // Saved [A(0), B(1)] with A removed but not saved yet: only B(1) remains in the cell.
  const assignments: AssignmentMap = { '2026-10-05-MORNING-manager': [{ id: 'b', employeeId: 'b', employeeDisplayName: 'בני', positionId: 'manager', positionName: 'אחמ״ש', shiftType: 'MORNING', slotIndex: 1 }] };
  render(<ShiftSection shiftType="MORNING" weekDays={[{ iso: '2026-10-05', dayOfWeek: 1, letter: 'ב', label: '05/10' }]} assignments={assignments} employees={[]} capacity={[{ ...rule, amount: 2 }]} scheduleId="schedule" facilityId="facility" />);
  expect(screen.getByText('בני')).toHaveAttribute('data-slot', '1');
  expect(screen.getByText('פנוי')).toHaveAttribute('data-slot', '0');
});
