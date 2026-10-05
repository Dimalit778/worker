// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VersionProvider } from '@/features/schedules/shared/version-context';
import { DraftActions } from '@/features/schedules/draft-schedule/components/draft-actions';

const publishSchedule = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));
vi.mock('@/features/schedules/draft-schedule/actions', () => ({ publishSchedule }));
vi.mock('@/features/schedules/generation/actions', () => ({ generateAutoSchedule: vi.fn() }));
vi.mock('@/features/schedules/hooks', () => ({ invalidateScheduleQueries: vi.fn() }));
afterEach(cleanup);

it('shows the two actions and allows publication without a status badge or reason field', async () => {
  render(<QueryClientProvider client={new QueryClient()}><VersionProvider value={{ versionId: 'schedule', revision: 1 }}><DraftActions scheduleId="schedule" scheduleStatus="LOCKED" /></VersionProvider></QueryClientProvider>);
  expect(screen.queryByRole('button', { name: 'סיים עריכה' })).not.toBeInTheDocument();
  expect(screen.queryByText('נעול')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'צור שיבוץ אוטומטי' })).toBeInTheDocument();
  const publish = screen.getByRole('button', { name: 'פרסם שיבוץ' });
  expect(publish).toBeEnabled();
  fireEvent.click(publish);
  await waitFor(() => expect(publishSchedule).toHaveBeenCalledWith('schedule', { versionId: 'schedule', revision: 1, confirmIssues: false }));
});
