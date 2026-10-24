// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { EmployeeHomeScreen } from '@/features/schedules/screens/employee-home-screen';
import type { CurrentScheduleData } from '@/features/schedules/types';

const query = vi.hoisted(() => ({ data: null as CurrentScheduleData | null, isLoading: false, isError: false, refetch: vi.fn() }));
const upcomingQuery = vi.hoisted(() => ({ data: null as CurrentScheduleData | null }));
vi.mock('@/features/schedules/hooks', () => ({ useEmployeeCurrentSchedule: () => query, useUpcomingSchedule: () => upcomingQuery }));
afterEach(() => { cleanup(); query.data = null; query.isError = false; query.isLoading = false; upcomingQuery.data = null; });

it('shows only the employee shifts and separates the next shift from the rest', () => {
  query.data = {
    scheduleId: 's', scheduleName: 'השיבוץ הנוכחי', startDate: '2026-10-18', endDate: '2026-10-24',
    facilityId: 'f', employees: [], capacity: [], warnings: [], overflowCandidates: {}, scheduleStatus: 'PUBLISHED',
    assignments: {
      '2026-10-21-MORNING-p': [{ id: 'a', employeeId: 'me', employeeDisplayName: 'אני', positionId: 'p', positionName: 'תפקיד קרוב', shiftType: 'MORNING', slotIndex: 0 }],
      '2026-10-22-EVENING-p': [{ id: 'b', employeeId: 'me', employeeDisplayName: 'אני', positionId: 'p', positionName: 'תפקיד נוסף', shiftType: 'EVENING', slotIndex: 0, customHours: { startTime: '16:00', endTime: '22:00' } }],
      '2026-10-23-MORNING-p': [{ id: 'c', employeeId: 'other', employeeDisplayName: 'אחר', positionId: 'p', positionName: 'תפקיד אחר', shiftType: 'MORNING', slotIndex: 0 }],
    },
  };
  render(<EmployeeHomeScreen employeeId="me" initialNow="2026-10-20T12:00:00Z" />);
  const nextCard = screen.getByRole('heading', { name: 'המשמרת הקרובה שלך' }).closest('[data-slot="card"]') as HTMLElement;
  expect(within(nextCard).getByText('בוקר · תפקיד קרוב')).toBeInTheDocument();
  expect(within(screen.getByRole('list')).getByText('ערב · תפקיד נוסף')).toBeInTheDocument();
  expect(screen.getByText('16:00–22:00')).toBeInTheDocument();
  expect(screen.queryByText(/תפקיד אחר/)).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'לשיבוץ המלא' })).toHaveAttribute('href', '/employee');
});

it('explains when no current published schedule exists', () => {
  render(<EmployeeHomeScreen employeeId="me" initialNow="2026-10-20T12:00:00Z" />);
  expect(screen.getByText(/אין שיבוץ נוכחי שפורסם/)).toBeInTheDocument();
});

it('offers a retry when loading fails', () => {
  query.isError = true;
  render(<EmployeeHomeScreen employeeId="me" initialNow="2026-10-20T12:00:00Z" />);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ניסיון טעינה מחדש' })).toBeInTheDocument();
});

it('lists the employee shifts from the next published schedule before it starts', () => {
  upcomingQuery.data = {
    scheduleId: 'n', scheduleName: 'השיבוץ הבא', startDate: '2026-10-25', endDate: '2026-10-31',
    facilityId: 'f', employees: [], capacity: [], warnings: [], overflowCandidates: {}, scheduleStatus: 'PUBLISHED',
    assignments: {
      '2026-10-26-MORNING-p': [{ id: 'n1', employeeId: 'me', employeeDisplayName: 'אני', positionId: 'p', positionName: 'תפקיד הבא', shiftType: 'MORNING', slotIndex: 0 }],
      '2026-10-27-MORNING-p': [{ id: 'n2', employeeId: 'other', employeeDisplayName: 'אחר', positionId: 'p', positionName: 'תפקיד אחר', shiftType: 'MORNING', slotIndex: 0 }],
    },
  };
  render(<EmployeeHomeScreen employeeId="me" initialNow="2026-10-20T12:00:00Z" />);
  const card = screen.getByRole('heading', { name: 'המשמרות שלך בשיבוץ הבא' }).closest('[data-slot="card"]') as HTMLElement;
  expect(within(card).getByText('בוקר · תפקיד הבא')).toBeInTheDocument();
  expect(screen.queryByText(/תפקיד אחר/)).not.toBeInTheDocument();
});
