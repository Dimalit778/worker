// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({ createSchedule: vi.fn(), fetchSubmissionWindowRule: vi.fn() }));
vi.mock('@/features/periods/actions', () => ({ createSchedule: mocks.createSchedule }));
vi.mock('@/features/settings/actions', () => ({ fetchSubmissionWindowRule: mocks.fetchSubmissionWindowRule }));
vi.mock('@/features/schedules/hooks', () => ({ invalidateScheduleQueries: vi.fn() }));
import { CreatePeriodForm } from '@/features/periods/components/create-period-form';
import { ScheduleStatusCards } from '@/features/dashboard/components/schedule-status-cards';
import { PeriodScheduleStatus } from '@/features/schedules/period-status';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  mocks.fetchSubmissionWindowRule.mockResolvedValue({ openWeekday: 3, openTime: '10:00', closeWeekday: 5, closeTime: '17:00' });
  mocks.createSchedule.mockResolvedValue({ ok: true, id: 'new' });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('lets the manager recover from overlap by choosing a later period and recalculates submission dates', async () => {
  mocks.createSchedule.mockResolvedValueOnce({ error: 'התקופה חופפת' });
  render(<QueryClientProvider client={new QueryClient()}><CreatePeriodForm /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'תקופה חדשה' }));
  await waitFor(() => expect(screen.getByLabelText('סגירת ההגשה')).not.toHaveValue(''));
  fireEvent.click(screen.getByRole('button', { name: 'צור תקופה' }));
  await screen.findByText('התקופה חופפת');
  fireEvent.change(screen.getByLabelText('תאריך התחלה'), { target: { value: '2098-11-02' } });
  expect(screen.getByText('2098-11-15')).toBeInTheDocument();
  expect(screen.getByLabelText('שליחה לעובדים')).toHaveValue('2098-10-29T10:00');
  expect(screen.getByLabelText('סגירת ההגשה')).toHaveValue('2098-10-31T17:00');
  fireEvent.click(screen.getByRole('button', { name: 'צור תקופה' }));
  await waitFor(() => expect(mocks.createSchedule).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: '2098-11-02', endDate: '2098-11-15' })));
});
it('keeps the chosen start when switching to a seven-day period', async () => {
  render(<QueryClientProvider client={new QueryClient()}><CreatePeriodForm /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'תקופה חדשה' }));
  await waitFor(() => expect(screen.getByLabelText('סגירת ההגשה')).not.toHaveValue(''));
  fireEvent.change(screen.getByLabelText('תאריך התחלה'), { target: { value: '2098-11-02' } });
  fireEvent.click(screen.getByRole('radio', { name: /^שבועי / }));
  expect(screen.getByLabelText('תאריך התחלה')).toHaveValue('2098-11-02');
  expect(screen.getByText('2098-11-08')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'צור תקופה' }));
  await waitFor(() => expect(mocks.createSchedule).toHaveBeenCalledWith(expect.objectContaining({ startDate: '2098-11-02', endDate: '2098-11-08' })));
});
it('links the preparation card to the exact displayed period', () => {
  render(<QueryClientProvider client={new QueryClient()}><ScheduleStatusCards activeSchedule={null} draftSchedule={{ id: 'selected', name: 'השיבוץ הנבחר', startDate: '2026-10-25', endDate: '2026-11-07', status: PeriodScheduleStatus.LOCKED }} warnings={[]} submissionSummary={null} /></QueryClientProvider>);
  expect(screen.getByRole('link', { name: /השיבוץ הנבחר/ })).toHaveAttribute('href', '/manager/draft?scheduleId=selected');
});
