// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EmployeeScheduleScreen } from '@/features/schedules/screens/employee-schedule-screen';
import type { CurrentScheduleData } from '@/features/schedules/types';

const current = vi.hoisted(() => ({ data: null as unknown, isLoading: false, isError: false }));
const upcoming = vi.hoisted(() => ({ data: null as unknown }));
vi.mock('@/features/schedules/hooks', () => ({ useEmployeeCurrentSchedule: () => current, useUpcomingSchedule: () => upcoming }));
vi.mock('@/features/schedules/screens/current-schedule-screen', () => ({
  CurrentScheduleScreen: ({ data }: { data?: CurrentScheduleData | null }) => <p>{data?.scheduleName ?? 'ריק'}</p>,
}));
afterEach(() => { cleanup(); current.data = null; upcoming.data = null; });

it('switches between the current and the next published schedule', () => {
  current.data = { scheduleName: 'נוכחי' };
  upcoming.data = { scheduleName: 'הבא' };
  render(<EmployeeScheduleScreen employeeId="me" />);
  expect(screen.getByText('נוכחי')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'השיבוץ הבא' }));
  expect(screen.getByText('הבא')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'השיבוץ הנוכחי' }));
  expect(screen.getByText('נוכחי')).toBeInTheDocument();
});

it('hides the button when no next schedule is published', () => {
  current.data = { scheduleName: 'נוכחי' };
  render(<EmployeeScheduleScreen employeeId="me" />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
