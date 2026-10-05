// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScheduleCalendar } from '@/features/availability/components/schedule-calendar';
import { submitAvailability } from '@/features/availability/actions';
vi.mock('@/features/availability/actions', () => ({ submitAvailability: vi.fn(async () => ({ ok: true })) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function setup(initialSubmitted = false) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ScheduleCalendar period={{ id: 'explicit-period', name: 'test', startDate: '2098-01-06', endDate: '2098-01-06', status: 'OPEN' }} initialEntries={{}} initialSubmitted={initialSubmitted} />
  </QueryClientProvider>);
}
it('selects a colored shift and submits the explicit period', async () => {
  setup();
  const shift = screen.getByRole('button', { name: '2098-01-06 בוקר' });
  expect(shift).toHaveAttribute('aria-pressed', 'false');
  expect(shift).toBeEmptyDOMElement();
  fireEvent.click(shift);
  expect(shift).toHaveAttribute('aria-pressed', 'true');
  expect(shift).toHaveClass('bg-amber-400');
  fireEvent.click(screen.getByRole('button', { name: 'הגש זמינות' }));
  await waitFor(() => expect(submitAvailability).toHaveBeenCalledWith({ periodId: 'explicit-period', entries: { '2098-01-06-MORNING': 'AVAILABLE' }, note: '' }, expect.anything()));
});
it('clears the shift on the second click', async () => {
  setup();
  const shift = screen.getByRole('button', { name: '2098-01-06 בוקר' });
  fireEvent.click(shift);
  fireEvent.click(shift);
  expect(shift).toHaveAttribute('aria-pressed', 'false');
  expect(shift).not.toHaveClass('bg-amber-400');
  fireEvent.click(screen.getByRole('button', { name: 'הגש זמינות' }));
  await waitFor(() => expect(submitAvailability).toHaveBeenCalledWith({ periodId: 'explicit-period', entries: { '2098-01-06-MORNING': 'UNAVAILABLE' }, note: '' }, expect.anything()));
});
it('allows a submitted employee to update availability and submit no available shifts', async () => {
  setup(true);
  const submit = screen.getByRole('button', { name: 'עדכן זמינות' });
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
  await waitFor(() => expect(submitAvailability).toHaveBeenCalled());
});
