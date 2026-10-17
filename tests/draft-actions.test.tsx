// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VersionProvider } from '@/features/schedules/shared/version-context';
import { DraftActions } from '@/features/schedules/draft-schedule/components/draft-actions';

const publishSchedule = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));
const generateAutoSchedule = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));
const getPublishReview = vi.hoisted(() => vi.fn());
const getSubmissionReadiness = vi.hoisted(() => vi.fn());
vi.mock('@/features/schedules/draft-schedule/actions', () => ({ publishSchedule }));
vi.mock('@/features/schedules/generation/actions', () => ({ generateAutoSchedule }));
vi.mock('@/features/schedules/hooks', () => ({ invalidateScheduleQueries: vi.fn() }));
vi.mock('@/features/schedules/readiness/queries', () => ({ getPublishReview, getSubmissionReadiness, getEmployeeLoad: vi.fn() }));
afterEach(cleanup);

const review = (overrides = {}) => ({
  ok: true, versionId: 'schedule', revision: 1, draftVersionNumber: 2, publishedVersionNumber: 1, isFirstPublication: false,
  errorCount: 0, shortages: [], issues: [], exceptions: [], changes: [], ...overrides,
});

beforeEach(() => {
  publishSchedule.mockClear();
  generateAutoSchedule.mockClear();
  getPublishReview.mockResolvedValue(review());
  getSubmissionReadiness.mockResolvedValue({
    scheduleId: 'schedule', closesAt: '2026-10-20T00:00:00.000Z', total: 3,
    counts: { NOT_SUBMITTED: 1, DRAFT: 1, SUBMITTED: 1, UNSUBMITTED_CHANGES: 0 },
    employees: [
      { id: 'a', displayName: 'אבי', roleName: 'מאבטח', status: 'NOT_SUBMITTED', submittedAt: null, draftSavedAt: null },
      { id: 'b', displayName: 'בני', roleName: 'מאבטח', status: 'DRAFT', submittedAt: null, draftSavedAt: null },
      { id: 'c', displayName: 'גיל', roleName: 'מאבטח', status: 'SUBMITTED', submittedAt: '2026-10-18T00:00:00.000Z', draftSavedAt: null },
    ],
  });
});

function renderActions() {
  render(<QueryClientProvider client={new QueryClient()}><VersionProvider value={{ versionId: 'schedule', revision: 1 }}><DraftActions scheduleId="schedule" scheduleStatus="LOCKED" /></VersionProvider></QueryClientProvider>);
}

it('shows the two actions and publishes after the review without a status badge or reason field', async () => {
  renderActions();
  expect(screen.queryByRole('button', { name: 'סיים עריכה' })).not.toBeInTheDocument();
  expect(screen.queryByText('נעול')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'צור שיבוץ אוטומטי' })).toBeInTheDocument();
  const publish = screen.getByRole('button', { name: 'פרסם שיבוץ' });
  expect(publish).toBeEnabled();
  fireEvent.click(publish);
  expect(publishSchedule).not.toHaveBeenCalled();
  await screen.findByText('אין שינויים בשיבוץ העובדים.');
  expect(getPublishReview).toHaveBeenCalledWith('schedule', { versionId: 'schedule', revision: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'פרסם שיבוץ' }));
  await waitFor(() => expect(publishSchedule).toHaveBeenCalledWith('schedule', { versionId: 'schedule', revision: 1, confirmIssues: false }));
});

it('lists shortages, exceptions and changes, and confirms issues the manager reviewed', async () => {
  getPublishReview.mockResolvedValue(review({
    errorCount: 1,
    shortages: [{ id: 'w1', type: 'UNFILLED', severity: 'ERROR', message: 'משמרת לא מאוישת', date: '2026-10-18', shiftType: 'MORNING', employeeName: null, positionName: 'כניסה' }],
    exceptions: [{ slotId: 's1', date: '2026-10-19', shiftType: 'NIGHT', positionName: 'אולם', employeeName: 'דנה', messages: ['העובד סימן שאינו זמין למשמרת'] }],
    changes: [{ kind: 'reassigned', date: '2026-10-20', shiftType: 'EVENING', positionId: 'p1', positionName: 'כניסה', fromEmployeeId: 'a', fromEmployeeName: 'אבי', toEmployeeId: 'b', toEmployeeName: 'בני' }],
  }));
  renderActions();
  fireEvent.click(screen.getByRole('button', { name: 'פרסם שיבוץ' }));
  expect(await screen.findByText('משמרת לא מאוישת')).toBeInTheDocument();
  expect(screen.getByText('העובד סימן שאינו זמין למשמרת')).toBeInTheDocument();
  expect(screen.getByText(/אבי ← בני/)).toBeInTheDocument();
  expect(screen.getByText('השוואה לגרסה המפורסמת (גרסה 1).')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'פרסם למרות הבעיות' }));
  await waitFor(() => expect(publishSchedule).toHaveBeenCalledWith('schedule', { versionId: 'schedule', revision: 1, confirmIssues: true }));
});

it('says when this is the first publication', async () => {
  getPublishReview.mockResolvedValue(review({ isFirstPublication: true, publishedVersionNumber: null }));
  renderActions();
  fireEvent.click(screen.getByRole('button', { name: 'פרסם שיבוץ' }));
  expect(await screen.findByText('זהו הפרסום הראשון של השיבוץ לתקופה זו.')).toBeInTheDocument();
});

it('shows submission status before auto-generation and generates on confirm', async () => {
  renderActions();
  fireEvent.click(screen.getByRole('button', { name: 'צור שיבוץ אוטומטי' }));
  expect(await screen.findByText('הגישו 1 מתוך 3')).toBeInTheDocument();
  expect(screen.getByText('אבי')).toBeInTheDocument();
  expect(screen.getByText('בני')).toBeInTheDocument();
  expect(screen.queryByText('גיל')).not.toBeInTheDocument();
  expect(generateAutoSchedule).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'צור שיבוץ' }));
  await waitFor(() => expect(generateAutoSchedule).toHaveBeenCalledWith('schedule', { versionId: 'schedule', revision: 1 }));
});
