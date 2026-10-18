// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const save = vi.hoisted(() => vi.fn());
vi.mock('@/features/schedules/assignments/actions', () => ({ saveScheduleChanges: save }));
vi.mock('@/features/schedules/hooks', () => ({ applyScheduleEdit: vi.fn() }));

import { PendingEditsProvider, usePendingEdits } from '@/features/schedules/shared/pending-edits';
import { VersionProvider } from '@/features/schedules/shared/version-context';
import type { CurrentScheduleData } from '@/features/schedules/types';

const slot = { date: '2026-10-18', shiftType: 'MORNING' as const, positionId: 'p', slotIndex: 0 };
const data: CurrentScheduleData = {
  scheduleId: 's', scheduleName: 'test', startDate: '2026-10-18', endDate: '2026-10-24', facilityId: 'f',
  employees: [{ id: 'e1', displayName: 'דנה', position: null }, { id: 'e2', displayName: 'רון', position: null }],
  assignments: { '2026-10-18-MORNING-p': [{ id: 'a1', employeeId: 'e1', employeeDisplayName: 'דנה', positionId: 'p', positionName: 'P', shiftType: 'MORNING', slotIndex: 0 }] },
  capacity: [], warnings: [], overflowCandidates: {}, scheduleStatus: 'PUBLISHED',
};

function Probe() {
  const edits = usePendingEdits()!;
  return (
    <>
      <p>{edits.assignments['2026-10-18-MORNING-p']?.[0]?.employeeDisplayName ?? 'ריק'}</p>
      <button onClick={() => edits.setSlot(slot, 'e2')}>החלף</button>
      <button onClick={() => edits.setSlot(slot, 'e1')}>החזר</button>
    </>
  );
}
function renderProbe() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VersionProvider value={{ versionId: 'v', revision: 3 }}>
        <PendingEditsProvider data={data}><Probe /></PendingEditsProvider>
      </VersionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => save.mockReset());
afterEach(cleanup);

it('keeps edits local until save, then sends them together', async () => {
  save.mockResolvedValue({ ok: true });
  renderProbe();
  fireEvent.click(screen.getByText('החלף'));
  expect(screen.getByText('רון')).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
  await waitFor(() => expect(save).toHaveBeenCalledWith('s', { versionId: 'v', revision: 3 }, [{ ...slot, employeeId: 'e2' }]));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'שמירה' })).toBeNull());
});

it('drops a change that returns to the saved value, and discards on cancel', () => {
  renderProbe();
  fireEvent.click(screen.getByText('החלף'));
  fireEvent.click(screen.getByText('החזר'));
  expect(screen.queryByRole('button', { name: 'שמירה' })).toBeNull();
  fireEvent.click(screen.getByText('החלף'));
  fireEvent.click(screen.getByRole('button', { name: 'ביטול שינויים' }));
  expect(screen.getByText('דנה')).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});
