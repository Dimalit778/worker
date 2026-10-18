// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CurrentScheduleScreen } from '@/features/schedules/screens/current-schedule-screen';
import type { CurrentScheduleData } from '@/features/schedules/types';
vi.mock('@/features/schedules/shared/correction-button', () => ({ CorrectionButton: () => null }));
vi.mock('@/features/schedules/current-schedule', () => ({ CurrentScheduleView: () => <p>לוח יומי לבדיקה</p> }));
vi.mock('@/features/schedules/draft-schedule/weekly-draft-schedule-view', () => ({ WeeklyDraftScheduleView: () => <p>לוח שבועי לבדיקה</p> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('opens daily on mobile even for a manager weekly default and allows changing view', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const data: CurrentScheduleData = { scheduleId: 's', scheduleName: 'test', startDate: '2026-10-18', endDate: '2026-10-24', facilityId: 'f', employees: [], assignments: {}, capacity: [], warnings: [], overflowCandidates: {}, scheduleStatus: 'PUBLISHED' };
  render(<QueryClientProvider client={new QueryClient()}><CurrentScheduleScreen data={data} defaultView="weekly" isLoading={false} isError={false} loadingMessage="" errorMessage="" /></QueryClientProvider>);
  expect(screen.getByText('לוח יומי לבדיקה')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'תצוגה שבועית' }));
  expect(screen.getByText('לוח שבועי לבדיקה')).toBeInTheDocument();
});
