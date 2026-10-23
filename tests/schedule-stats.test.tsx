// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  expect(screen.getByRole('button', { name: /חוסר/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /חוסר/ })).toHaveTextContent('—');
  expect(screen.getByRole('button', { name: /הגשות/ })).toBeEnabled();
});

it('shows staffing shortages separately from employee problems after a schedule is created', () => {
  render(<ScheduleStats warnings={warnings} hasSchedule submittedCount={7} eligibleCount={20} missingEmployees={[]}
    readiness={{ scheduleId: 's', versionId: 'v', revision: 1 }} />);

  expect(screen.getByRole('button', { name: /בעיות/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: /בעיות/ })).toHaveTextContent('0');
  expect(screen.getByRole('button', { name: /חוסר/ })).toBeEnabled();
  expect(screen.getByRole('button', { name: /חוסר/ })).toHaveTextContent('1');
});

it('shows mandatory staffing details only under shortage and individual issues only under problems', () => {
  const minimum: ScheduleWarningSummary = { ...warnings[0], id: 'minimum', type: 'MIN_NOT_MET', employeeName: 'איתי', weekNumber: 1, shiftType: 'MORNING',
    message: 'שבוע 1: נדרשות 2 משמרות בוקר; בפועל: 1.' };
  const conflict: ScheduleWarningSummary = { ...minimum, id: 'vacation', type: 'CONFLICT', severity: 'WARNING',
    message: 'העובד משובץ בזמן חופשה מאושרת.' };
  const shortage = { ...warnings[0], date: '2026-10-25', shiftType: 'MORNING' as const, positionName: 'בקר',
    message: 'משובצים 1 מתוך 2 בחובה.' };
  render(<ScheduleStats warnings={[shortage, minimum, conflict]} hasSchedule submittedCount={7} eligibleCount={20} missingEmployees={[]}
    readiness={{ scheduleId: 's', versionId: 'v', revision: 1 }} />);
  expect(screen.getByRole('button', { name: /בעיות/ })).toHaveTextContent('2');
  expect(screen.getByRole('button', { name: /חוסר/ })).toHaveTextContent('1');
  fireEvent.click(screen.getByRole('button', { name: /בעיות/ }));
  expect(screen.getByText('איתי')).toBeInTheDocument();
  expect(screen.getByText('שבוע 1 — חסר בוקר')).toBeInTheDocument();
  expect(screen.queryByText(minimum.message)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /בעיות/ }).parentElement).toContainElement(screen.getByText('איתי'));
  expect(screen.getByText(`${conflict.message} — בוקר`)).toBeInTheDocument();
  expect(screen.queryByText(shortage.message)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /חוסר/ }));
  expect(screen.getByText('25/10 · בוקר · בקר')).toBeInTheDocument();
  expect(screen.queryByText(shortage.message)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /חוסר/ }).parentElement)
    .toContainElement(screen.getByText('חוסר לפי תקני חובה (1)'));
  expect(screen.queryByText(minimum.message)).not.toBeInTheDocument();
});
