// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ManagerScheduleScreen } from '@/features/schedules/screens/manager-chedule-screen';
import type { CurrentScheduleData } from '@/features/schedules/types';

const current = vi.hoisted(() => ({ data: null as unknown, isLoading: false, isError: false }));
const upcoming = vi.hoisted(() => ({ data: null as unknown }));
vi.mock('@/features/schedules/hooks', () => ({ useCurrentSchedule: () => current, useUpcomingSchedule: () => upcoming }));
vi.mock('@/features/schedules/assignments/actions', () => ({ fetchOriginalSchedule: vi.fn() }));
vi.mock('@/features/schedules/change-log/change-log-list', () => ({ ChangeLogList: () => null }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: null, isLoading: false, isError: false }) }));
vi.mock('@/features/schedules/screens/current-schedule-screen', () => ({
  CurrentScheduleScreen: ({ data, isReadOnly }: { data?: CurrentScheduleData | null; isReadOnly?: boolean }) => (
    <p>{data?.scheduleName ?? 'ריק'}{isReadOnly ? '' : ' (עריכה)'}</p>
  ),
}));
afterEach(() => { cleanup(); current.data = null; upcoming.data = null; });

it('lets the manager switch to the next published schedule and edit it', () => {
  current.data = { scheduleId: 'c', scheduleName: 'נוכחי' };
  upcoming.data = { scheduleId: 'n', scheduleName: 'הבא' };
  render(<ManagerScheduleScreen />);
  expect(screen.getByText('נוכחי (עריכה)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'השיבוץ הבא' }));
  expect(screen.getByText('הבא (עריכה)')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'השיבוץ הנוכחי' }));
  expect(screen.getByText('נוכחי (עריכה)')).toBeInTheDocument();
});

it('hides the button when no next schedule is published', () => {
  current.data = { scheduleId: 'c', scheduleName: 'נוכחי' };
  render(<ManagerScheduleScreen />);
  expect(screen.queryByRole('button', { name: 'השיבוץ הבא' })).not.toBeInTheDocument();
});
