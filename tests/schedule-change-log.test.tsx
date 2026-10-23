// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ScheduleChangeLogEntry } from '@/features/schedules/change-log/queries';
import type { CurrentScheduleData } from '@/features/schedules/types';

const actions = vi.hoisted(() => ({
  fetchScheduleChangeLog: vi.fn(),
  fetchDraftSchedule: vi.fn(),
  fetchCurrentSchedule: vi.fn(),
  fetchOriginalSchedule: vi.fn(),
}));
vi.mock('@/features/schedules/change-log/actions', () => ({ fetchScheduleChangeLog: actions.fetchScheduleChangeLog }));
vi.mock('@/features/schedules/assignments/actions', () => ({
  fetchDraftSchedule: actions.fetchDraftSchedule,
  fetchCurrentSchedule: actions.fetchCurrentSchedule,
  fetchOriginalSchedule: actions.fetchOriginalSchedule,
  saveScheduleChanges: vi.fn(),
}));
vi.mock('@/features/schedules/assignments/upcoming-actions', () => ({ fetchUpcomingSchedule: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/schedules/shared/correction-button', () => ({ CorrectionButton: () => null }));
vi.mock('@/features/periods/components/create-period-form', () => ({ CreatePeriodForm: () => null }));
vi.mock('@/features/periods/components/deadline-extension', () => ({ DeadlineExtension: () => null }));
vi.mock('@/features/schedules/draft-schedule/topbar', () => ({ TopBar: () => null }));
vi.mock('@/features/schedules/draft-schedule/schedule-stats', () => ({
  ScheduleStats: ({ hasSchedule }: { hasSchedule: boolean }) => <div data-testid="schedule-stats" data-has-schedule={String(hasSchedule)} />,
}));
vi.mock('@/features/schedules/current-schedule', () => ({ CurrentScheduleView: () => <p>לוח יומי לבדיקה</p> }));
vi.mock('@/features/schedules/draft-schedule/weekly-draft-schedule-view', () => ({ WeeklyDraftScheduleView: (props: { readonly?: boolean }) => <p data-readonly={String(props.readonly)}>לוח שבועי לבדיקה</p> }));

import { ChangeLogList } from '@/features/schedules/change-log/change-log-list';
import { CurrentScheduleScreen } from '@/features/schedules/screens/current-schedule-screen';
import { ManagerDraftScreen } from '@/features/schedules/screens/manager-draft-screen';
import { ManagerScheduleScreen } from '@/features/schedules/screens/manager-chedule-screen';

const entry = (over: Partial<ScheduleChangeLogEntry>): ScheduleChangeLogEntry => ({
  id: 'c1', createdAt: new Date('2026-10-20T08:30:00Z'), changeType: 'UPDATE',
  message: 'הוחלף עובד במשמרת בוקר', summary: null, shiftLabel: null, shiftDateLabel: null, actionKind: null,
  versionNumber: 2, changedByName: 'מנהל ראשי', ...over,
});
const data: CurrentScheduleData = {
  scheduleId: 's1', scheduleName: 'שבוע 43', startDate: '2026-10-18', endDate: '2026-10-24', facilityId: 'f', employees: [],
  assignments: {}, capacity: [], warnings: [], overflowCandidates: {}, scheduleStatus: 'DRAFT', versionId: 'v1', revision: 1,
};

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  actions.fetchScheduleChangeLog.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it('lists one schedule\'s changes newest first and shows each reason once', async () => {
  actions.fetchScheduleChangeLog.mockResolvedValue([
    entry({ id: 'c2', message: 'פורסמה גרסה חדשה', versionNumber: 3, changedByName: 'דנה' }),
    entry({ id: 'c1' }),
  ]);
  wrap(<ChangeLogList scheduleId="s1" versionId="v1" revision={1} />);

  expect(await screen.findByText('שינויים בשיבוץ')).toBeInTheDocument();
  expect(await screen.findByText('פורסמה גרסה חדשה')).toBeInTheDocument();
  expect(actions.fetchScheduleChangeLog).toHaveBeenCalledWith('s1');
  for (const label of ['מתי', 'שונה על ידי', 'שינוי', 'משמרת', 'תאריך']) {
    expect(screen.getByText(label)).toBeInTheDocument();
  }

  const rows = screen.getAllByRole('row').slice(1);
  expect(rows).toHaveLength(2);
  expect(within(rows[0]).getByText('דנה')).toBeInTheDocument();
  expect(screen.queryByText(/גרסה 3/)).not.toBeInTheDocument();
  expect(within(rows[1]).getByText('מנהל ראשי')).toBeInTheDocument();
  expect(screen.getAllByText(/הוחלף עובד במשמרת בוקר/)).toHaveLength(1);
  expect(screen.queryByText(/סיבה:/)).not.toBeInTheDocument();
});

it('hides automatic regenerate noise rows', async () => {
  actions.fetchScheduleChangeLog.mockResolvedValue([
    entry({ id: 'noise', message: 'יצירה אוטומטית מחדש; איושים נעולים נשמרו' }),
    entry({ id: 'keep', message: 'פורסמה גרסה חדשה' }),
  ]);
  wrap(<ChangeLogList scheduleId="s1" versionId="v1" revision={1} />);

  expect(await screen.findByText('פורסמה גרסה חדשה')).toBeInTheDocument();
  expect(screen.queryByText(/יצירה אוטומטית מחדש/)).not.toBeInTheDocument();
  expect(screen.getAllByRole('row').slice(1)).toHaveLength(1);
});

it('shows join/leave rows with packed audit and shift/date clusters', async () => {
  actions.fetchScheduleChangeLog.mockResolvedValue([
    entry({
      id: 'join',
      message: 'שיר · ערב · 27/10/2026 · יום ג',
      summary: 'שיר',
      shiftLabel: 'ערב',
      shiftDateLabel: '27/10/2026 · יום ג',
      actionKind: 'joined',
      changedByName: 'מנהל',
    }),
  ]);
  wrap(<ChangeLogList scheduleId="s1" versionId="v1" revision={1} />);

  const row = (await screen.findAllByRole('row')).slice(1)[0];
  const cells = within(row).getAllByRole('cell');
  expect(cells).toHaveLength(2);
  expect(within(cells[0]).getByText('מנהל')).toBeInTheDocument();
  expect(within(cells[1]).getByText('שיר')).toBeInTheDocument();
  expect(within(cells[1]).getByText('ערב')).toBeInTheDocument();
  expect(within(cells[1]).getByText('27/10/2026 · יום ג')).toBeInTheDocument();
  expect(within(row).queryByText(/חריגות/)).not.toBeInTheDocument();
  expect(within(row).queryByText(/יצטרף/)).not.toBeInTheDocument();
});

it('shows the empty state when the schedule has no changes', async () => {
  wrap(<ChangeLogList scheduleId="s1" versionId="v1" revision={1} />);
  expect(await screen.findByText('אין שינויים רשומים.')).toBeInTheDocument();
  expect(screen.getByText('שינויים בשיבוץ')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('refetches when the schedule revision changes', async () => {
  const client = new QueryClient();
  const ui = (revision: number) => (
    <QueryClientProvider client={client}><ChangeLogList scheduleId="s1" versionId="v1" revision={revision} /></QueryClientProvider>
  );
  const { rerender } = render(ui(1));
  await screen.findByText('אין שינויים רשומים.');
  expect(actions.fetchScheduleChangeLog).toHaveBeenCalledTimes(1);

  actions.fetchScheduleChangeLog.mockResolvedValue([entry({ message: 'שינוי חדש' })]);
  rerender(ui(2));
  expect(await screen.findByText('שינוי חדש')).toBeInTheDocument();
  expect(actions.fetchScheduleChangeLog).toHaveBeenCalledTimes(2);
});

it('manager draft screen shows the section below the schedule when data exists', async () => {
  actions.fetchDraftSchedule.mockResolvedValue(data);
  actions.fetchScheduleChangeLog.mockResolvedValue([entry({})]);
  wrap(<ManagerDraftScreen scheduleId="s1" />);

  const schedule = await screen.findByText('לוח שבועי לבדיקה');
  const section = await screen.findByText('שינויים בשיבוץ');
  expect(schedule.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(await screen.findByText('הוחלף עובד במשמרת בוקר', { exact: false })).toBeInTheDocument();
  expect(actions.fetchScheduleChangeLog).toHaveBeenCalledWith('s1');
});

it('manager draft screen hides the section when there is no schedule', async () => {
  actions.fetchDraftSchedule.mockResolvedValue(null);
  wrap(<ManagerDraftScreen />);
  expect(await screen.findByText('שיבוץ בהכנה')).toBeInTheDocument();
  expect(screen.queryByText('שינויים בשיבוץ')).not.toBeInTheDocument();
  expect(actions.fetchScheduleChangeLog).not.toHaveBeenCalled();
});

it.each([
  { revision: 0, expected: 'false' },
  { revision: 1, expected: 'true' },
])('distinguishes a new empty draft from a generated draft at revision $revision', async ({ revision, expected }) => {
  actions.fetchDraftSchedule.mockResolvedValue({ ...data, revision });
  wrap(<ManagerDraftScreen scheduleId="s1" />);
  expect(await screen.findByTestId('schedule-stats')).toHaveAttribute('data-has-schedule', expected);
});

it('manager current-schedule screen shows the section only when a schedule exists', async () => {
  actions.fetchCurrentSchedule.mockResolvedValue(data);
  wrap(<ManagerScheduleScreen />);
  expect(await screen.findByText('שינויים בשיבוץ')).toBeInTheDocument();
  await waitFor(() => expect(actions.fetchScheduleChangeLog).toHaveBeenCalledWith('s1'));
  cleanup();

  actions.fetchScheduleChangeLog.mockClear();
  actions.fetchCurrentSchedule.mockResolvedValue(null);
  wrap(<ManagerScheduleScreen />);
  expect(await screen.findByText('אין שיבוץ פעיל')).toBeInTheDocument();
  expect(screen.queryByText('שינויים בשיבוץ')).not.toBeInTheDocument();
  expect(actions.fetchScheduleChangeLog).not.toHaveBeenCalled();
});

it('the shared current-schedule screen used by employees does not show the section', () => {
  wrap(<CurrentScheduleScreen data={data} isLoading={false} isError={false} loadingMessage="" errorMessage="" />);
  expect(screen.getByText('לוח שבועי לבדיקה')).toBeInTheDocument();
  expect(screen.queryByText('שינויים בשיבוץ')).not.toBeInTheDocument();
  expect(actions.fetchScheduleChangeLog).not.toHaveBeenCalled();
});

it('opens the original on demand in read-only mode beside the editable current roster', async () => {
  actions.fetchCurrentSchedule.mockResolvedValue({ ...data, scheduleStatus: 'PUBLISHED' });
  actions.fetchOriginalSchedule.mockResolvedValue({ ...data, versionId: 'original' });
  wrap(<ManagerScheduleScreen />);
  const summary = await screen.findByText('השיבוץ המקורי כפי שפורסם לראשונה');
  expect(actions.fetchOriginalSchedule).not.toHaveBeenCalled();
  fireEvent.click(summary);
  await waitFor(() => expect(actions.fetchOriginalSchedule).toHaveBeenCalledWith('s1'));
  await waitFor(() => expect(screen.getAllByText('לוח שבועי לבדיקה')).toHaveLength(2));
  expect(screen.getAllByText('לוח שבועי לבדיקה').map(node => node.dataset.readonly)).toEqual(['false', 'true']);
});
