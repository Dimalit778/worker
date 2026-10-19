// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScheduleCalendar } from '@/features/availability/components/schedule-calendar';
import { saveAvailabilityDraft, submitAvailability } from '@/features/availability/actions';
import type { AvailabilityStatus } from '@/features/availability/utils';
vi.mock('@/features/availability/actions', () => ({
  submitAvailability: vi.fn(async () => ({ ok: true, savedAt: '2098-01-01T10:00:00.000Z' })),
  saveAvailabilityDraft: vi.fn(async () => ({ ok: true, savedAt: '2098-01-01T10:00:00.000Z' })),
  discardAvailabilityDraft: vi.fn(async () => ({ ok: true })),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

type SetupOptions = {
  endDate?: string;
  entries?: Record<string, 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE'>;
  submitted?: boolean;
  status?: AvailabilityStatus;
};
function setup({ endDate = '2098-01-06', entries = {}, submitted = false, status }: SetupOptions = {}) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ScheduleCalendar
        period={{ id: 'explicit-period', name: 'test', startDate: '2098-01-06', endDate, status: 'OPEN' }}
        initialEntries={entries}
        initialSubmitted={submitted}
        status={status}
        closesAt="2098-01-05T10:00:00.000Z"
      />
    </QueryClientProvider>,
  );
}
const cell = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}:`) });
const statusText = () => screen.getByTestId('availability-status').textContent;

it('toggles a shift between empty and available', () => {
  setup();
  const shift = cell('2098-01-06 בוקר');
  expect(shift).toHaveAttribute('data-state', 'EMPTY');
  fireEvent.click(shift);
  expect(shift).toHaveAttribute('data-state', 'AVAILABLE');
  expect(shift).toHaveAccessibleName('2098-01-06 בוקר: זמין');
  fireEvent.click(shift);
  expect(shift).toHaveAttribute('data-state', 'EMPTY');
});

it('saves a draft without submitting', async () => {
  setup();
  expect(statusText()).toBe('לא הוגש');
  expect(screen.getByRole('button', { name: 'שמור טיוטה' })).toBeDisabled();
  fireEvent.click(cell('2098-01-06 בוקר'));
  expect(screen.getByText('יש שינויים שלא נשמרו')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'שמור טיוטה' }));
  await waitFor(() =>
    expect(saveAvailabilityDraft).toHaveBeenCalledWith(
      { periodId: 'explicit-period', entries: { '2098-01-06-MORNING': 'AVAILABLE' }, note: '' },
      expect.anything(),
    ),
  );
  expect(submitAvailability).not.toHaveBeenCalled();
  await waitFor(() => expect(statusText()).toBe('טיוטה'));
  expect(screen.queryByText('יש שינויים שלא נשמרו')).not.toBeInTheDocument();
});

it('submits only explicit choices', async () => {
  setup();
  fireEvent.click(cell('2098-01-06 ערב'));
  fireEvent.click(screen.getByRole('button', { name: 'הגש זמינות' }));
  await waitFor(() =>
    expect(submitAvailability).toHaveBeenCalledWith(
      { periodId: 'explicit-period', entries: { '2098-01-06-EVENING': 'AVAILABLE' }, note: '' },
      expect.anything(),
    ),
  );
  await waitFor(() => expect(statusText()).toBe('הוגש'));
});

it('shows unsubmitted changes after editing a submitted form', async () => {
  setup({ submitted: true, entries: { '2098-01-06-MORNING': 'AVAILABLE' } });
  expect(statusText()).toBe('הוגש');
  const submit = screen.getByRole('button', { name: 'הגש שינויים' });
  expect(submit).toBeDisabled();
  fireEvent.click(cell('2098-01-06 בוקר'));
  expect(statusText()).toBe('שינויים שלא הוגשו');
  fireEvent.click(screen.getByRole('button', { name: 'שמור טיוטה' }));
  await waitFor(() => expect(saveAvailabilityDraft).toHaveBeenCalled());
  expect(statusText()).toBe('שינויים שלא הוגשו');
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
  await waitFor(() => expect(statusText()).toBe('הוגש'));
});

it('renders a single week for a 7-day period', () => {
  setup({ endDate: '2098-01-12' });
  expect(screen.getByText('שבוע 1')).toBeInTheDocument();
  expect(screen.queryByText('שבוע 2')).not.toBeInTheDocument();
});

it('marks a whole day available from its header', () => {
  setup({ endDate: '2098-01-19' });
  fireEvent.click(screen.getByRole('button', { name: 'החל ״זמין״ על יום 2098-01-06' }));
  expect(cell('2098-01-06 בוקר')).toHaveAttribute('data-state', 'AVAILABLE');
  expect(cell('2098-01-06 לילה')).toHaveAttribute('data-state', 'AVAILABLE');
  expect(cell('2098-01-07 ערב')).toHaveAttribute('data-state', 'EMPTY');
});
it('shows both weeks at once and submits selections from each', async () => {
  render(<QueryClientProvider client={new QueryClient()}>
    <ScheduleCalendar period={{ id: 'two-weeks', name: 'שבועיים', startDate: '2098-01-06', endDate: '2098-01-19', status: 'OPEN' }} initialEntries={{}} initialSubmitted={false} />
  </QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: /^2098-01-06 בוקר:/ }));
  fireEvent.click(screen.getByRole('button', { name: /^2098-01-13 בוקר:/ }));
  expect(screen.getByText('שבוע 1')).toBeInTheDocument();
  expect(screen.getByText('שבוע 2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'הגש זמינות' }));
  await waitFor(() => expect(submitAvailability).toHaveBeenCalledWith({ periodId: 'two-weeks', entries: { '2098-01-06-MORNING': 'AVAILABLE', '2098-01-13-MORNING': 'AVAILABLE' }, note: '' }, expect.anything()));
});
