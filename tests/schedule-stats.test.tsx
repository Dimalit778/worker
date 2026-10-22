// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ScheduleStats } from '@/features/schedules/draft-schedule/schedule-stats';
import type { ScheduleWarningSummary } from '@/features/schedules/types';

vi.mock('@/features/schedules/readiness/hooks', () => ({
  useSubmissionReadiness: () => ({ data: undefined }),
  useEmployeeLoad: () => ({}),
}));

afterEach(cleanup);

const warnings: ScheduleWarningSummary[] = [{
  id: 'unfilled', type: 'UNFILLED', severity: 'ERROR', message: 'חסר עובד',
  date: null, shiftType: null, employeeName: null, positionName: null,
}];

it('keeps submissions available but suppresses warning counts for a new empty period', () => {
  render(<ScheduleStats warnings={warnings} hasSchedule={false} submittedCount={7} eligibleCount={20} missingEmployees={[]}
    readiness={{ scheduleId: 's', versionId: 'v', revision: 0 }} />);

  expect(screen.getByRole('button', { name: /בעיות/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /בעיות/ })).toHaveTextContent('—');
  expect(screen.getByRole('button', { name: /חוסרים/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /חוסרים/ })).toHaveTextContent('—');
  expect(screen.getByRole('button', { name: /הגשות/ })).toBeEnabled();
});

it('shows actionable warning counts after a schedule is created', () => {
  render(<ScheduleStats warnings={warnings} hasSchedule submittedCount={7} eligibleCount={20} missingEmployees={[]}
    readiness={{ scheduleId: 's', versionId: 'v', revision: 1 }} />);

  expect(screen.getByRole('button', { name: /בעיות/ })).toBeEnabled();
  expect(screen.getByRole('button', { name: /בעיות/ })).toHaveTextContent('1');
  expect(screen.getByRole('button', { name: /חוסרים/ })).toBeEnabled();
  expect(screen.getByRole('button', { name: /חוסרים/ })).toHaveTextContent('1');
});
