// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { RequestDto } from '@/features/requests/types';

const request = (over: Partial<RequestDto>): RequestDto => ({
  id: 'r1', type: 'TIME_OFF', status: 'PENDING_MANAGER', requesterId: 'u1', requesterName: 'דנה',
  targetUserId: null, targetName: null, startDate: '2026-10-20', endDate: '2026-10-22', slot: null,
  reason: null, decisionNote: null, overrideReason: null, decidedByName: null, decidedAt: null,
  createdAt: '2026-10-17T08:00:00.000Z', affectedSlots: [], ...over,
});

const actions = vi.hoisted(() => ({
  fetchMyRequests: vi.fn(),
  fetchTransferOptions: vi.fn().mockResolvedValue([]),
  fetchRequestQueue: vi.fn(),
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
  cancelRequest: vi.fn().mockResolvedValue({ ok: true }),
  respondToTransfer: vi.fn().mockResolvedValue({ ok: true }),
  createDateRequest: vi.fn(),
  createTransferRequest: vi.fn(),
}));
vi.mock('@/features/requests/actions', () => actions);
vi.mock('@/features/schedules/hooks', () => ({ invalidateScheduleQueries: vi.fn() }));

import { EmployeeRequestsClient } from '@/features/requests/components/employee-requests-client';
import { ManagerRequestsClient } from '@/features/requests/components/manager-requests-client';

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
afterEach(cleanup);

it('employee page lists own requests, incoming transfers and lets the employee respond', async () => {
  actions.fetchMyRequests.mockResolvedValue({
    mine: [request({})],
    incoming: [request({ id: 'r2', type: 'SHIFT_SWAP', status: 'PENDING_PEER', requesterName: 'יוסי', startDate: null, endDate: null,
      slot: { date: '2026-10-21', shiftType: 'MORNING', positionName: 'מאבטח', startsAt: '', endsAt: '' } })],
  });
  wrap(<EmployeeRequestsClient />);
  expect(await screen.findByText('בקשות העברה אליי')).toBeInTheDocument();
  expect(screen.getByText('ממתין למנהל')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'אשר קבלה' }));
  await waitFor(() => expect(actions.respondToTransfer).toHaveBeenCalledWith('r2', true));
  fireEvent.click(screen.getByRole('button', { name: 'בטל' }));
  await waitFor(() => expect(actions.cancelRequest).toHaveBeenCalledWith('r1'));
});

it('manager queue shows urgent first and asks for an override reason when a transfer has violations', async () => {
  actions.fetchRequestQueue.mockResolvedValue([
    request({ id: 'swap', type: 'SHIFT_SWAP', requesterName: 'יוסי', targetName: 'רון', startDate: null, endDate: null,
      slot: { date: '2026-10-21', shiftType: 'NIGHT', positionName: 'מאבטח', startsAt: '', endsAt: '' } }),
    request({ id: 'urgent', type: 'URGENT_ABSENCE', requesterName: 'מיכל', reason: 'מחלה',
      affectedSlots: [{ id: 's', date: '2026-10-20', shiftType: 'MORNING', positionName: 'מאבטח', scheduleName: 'תקופה', versionKind: 'PUBLISHED' }] }),
  ]);
  actions.approveRequest
    .mockResolvedValueOnce({ ok: false, requiresOverride: true, violations: [{ code: 'REST_GAP', message: 'פחות מ־8 שעות מנוחה בין משמרות' }] })
    .mockResolvedValueOnce({ ok: true, affectedSlots: [] });
  wrap(<ManagerRequestsClient />);
  const names = await screen.findAllByText(/^(יוסי|מיכל)$/);
  expect(names.map(n => n.textContent)).toEqual(['מיכל', 'יוסי']);
  expect(screen.getByText('דחוף')).toBeInTheDocument();
  expect(screen.getAllByRole('alert')[0]).toHaveTextContent('שיבוצים קיימים שנפגעים');

  fireEvent.click(screen.getByRole('button', { name: 'אשר' }));
  fireEvent.click(await screen.findByRole('button', { name: 'אשר' }));
  expect(await screen.findByText('פחות מ־8 שעות מנוחה בין משמרות')).toBeInTheDocument();
  const confirm = screen.getByRole('button', { name: 'אשר חריגה' });
  expect(confirm).toBeDisabled();
  fireEvent.change(screen.getByLabelText('נימוק לאישור חריגה'), { target: { value: 'אין מחליף אחר' } });
  fireEvent.click(confirm);
  await waitFor(() => expect(actions.approveRequest).toHaveBeenLastCalledWith('swap', { decisionNote: '', overrideReason: 'אין מחליף אחר' }));
});
