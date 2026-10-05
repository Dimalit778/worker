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

it('renders exactly one manager row even if legacy assignments contain an extra manager', () => {
  const assignment = { id: 'first', employeeId: 'first', employeeDisplayName: 'ראשון', positionId: 'manager', positionName: 'אחמ״ש', shiftType: 'MORNING' as const, slotIndex: 0 };
  const assignments: AssignmentMap = { '2026-10-05-MORNING-manager': [assignment, { ...assignment, id: 'second', employeeId: 'second', employeeDisplayName: 'שני', slotIndex: 1 }] };
  render(<ShiftSection shiftType="MORNING" weekDays={[{ iso: '2026-10-05', dayOfWeek: 1, letter: 'ב', label: '05/10' }]} assignments={assignments} employees={[]} capacity={[rule]} scheduleId="schedule" facilityId="facility" readonly />);
  expect(screen.getAllByRole('row')).toHaveLength(2); // header + one configured row
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
  const rows = screen.getAllByRole('row');
  const first = rows[1].querySelectorAll('td');
  expect(first[2]).toHaveAttribute('data-position', 'manager'); // Thursday retains the manager row
  expect(first[3]).toHaveAttribute('data-position', 'guard');
  expect(first[3]).toHaveAttribute('data-slot', '0');
  expect(first[3]).toHaveAttribute('data-color', '#00ff00');
  expect(first[4]).toHaveAttribute('data-position', 'guard');
  const second = rows[2].querySelectorAll('td');
  expect(second[2]).toHaveAttribute('data-position', 'controller');
  expect(second[3]).toHaveAttribute('data-position', 'guard');
  expect(second[3]).toHaveAttribute('data-slot', '1');
  expect(second[4]).toHaveAttribute('rowspan', '4'); // one blank area below Saturday's only slot
  expect(rows[3].querySelector('td[rowspan="3"]')).toBeInTheDocument(); // same for Friday after two slots
  expect(screen.queryByText('מאבטח')).not.toBeInTheDocument();
});

it('keeps configured role colors and order for a weekend with controller and guard positions', () => {
  const capacity: ScheduleCapacityRule[] = [
    ...baseRules,
    { ...baseRules[1], id: 'friday-controller', dayCategory: 'FRIDAY' },
    { ...baseRules[2], id: 'friday-guard', dayCategory: 'FRIDAY', amount: 1 },
  ];
  render(<ShiftSection shiftType="MORNING" weekDays={weekendDays} assignments={{}} employees={[]} capacity={capacity} scheduleId="schedule" facilityId="facility" />);
  const rows = screen.getAllByRole('row');
  const first = rows[1].querySelectorAll('td');
  expect(first[3]).toHaveAttribute('data-position', 'controller');
  expect(first[3]).toHaveAttribute('data-color', '#0000ff');
  expect(first[4]).toHaveAttribute('rowspan', '5'); // Saturday has no requirements
  const second = rows[2].querySelectorAll('td');
  expect(second[3]).toHaveAttribute('data-position', 'guard');
  expect(second[3]).toHaveAttribute('data-slot', '0');
});
