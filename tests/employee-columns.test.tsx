// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EmployeesTable } from '@/features/employess/components/employees-table';
import { EmployeeActions } from '@/features/employess/components/employee-actions';
import type { EmployeeListItem } from '@/features/employess/types';

const actions = vi.hoisted(() => ({
  push: vi.fn(),
  deleteEmployee: vi.fn(),
  resendEmployeeInvite: vi.fn(),
  setEmployeeActive: vi.fn(),
  deleteAdminEmployee: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: actions.push }) }));
vi.mock('@/features/employess/actions', () => ({
  deleteEmployee: actions.deleteEmployee,
  resendEmployeeInvite: actions.resendEmployeeInvite,
  setEmployeeActive: actions.setEmployeeActive,
}));
vi.mock('@/features/admin/actions', () => ({ deleteAdminEmployee: actions.deleteAdminEmployee }));
vi.mock('@/features/employess/components/employee-modal', () => ({
  EmployeeModal: () => <div role="dialog" aria-label="עריכת עובד" />,
}));

const employee: EmployeeListItem = {
  id: 'officer', firstName: 'קצין', lastName: 'מתקן', displayName: 'קצין מתקן',
  email: 'officer@example.test', phone: null, isReligious: false, isActive: true,
  position: { id: 'manager-role', name: 'קצין מתקן', rank: 1 },
};
const positions = [employee.position];
function wrap(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {ui}
  </QueryClientProvider>);
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('manager employee navigation', () => {
  it('removes row actions, keeps adding employees, and opens a detail page from the row', () => {
    wrap(<EmployeesTable employees={[employee]} positions={positions} currentUserId="manager" />);
    const row = screen.getAllByRole('row')[1];
    expect(within(row).queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'הוסף עובד' })).toBeInTheDocument();
    expect(within(row).getByRole('link')).toHaveAttribute('href', '/manager/employees/officer');
    fireEvent.click(within(row).getByText('officer@example.test'));
    expect(actions.push).toHaveBeenCalledWith('/manager/employees/officer');
  });

  it('keeps the admin table actions in their existing scope', () => {
    wrap(<EmployeesTable employees={[employee]} positions={positions} facilityId="court" />);
    expect(screen.getByRole('button', { name: 'עריכה' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'מחיקת עובד לצמיתות' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'השבתה' })).not.toBeInTheDocument();
  });
});

describe('employee detail actions', () => {
  it('protects the signed-in officer while keeping editing available', () => {
    wrap(<EmployeeActions employee={employee} positions={positions} currentUserId="officer" />);
    expect(screen.queryByRole('button', { name: 'מחיקת עובד לצמיתות' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'השבתה' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'עריכה' }));
    expect(screen.getByRole('dialog', { name: 'עריכת עובד' })).toBeInTheDocument();
  });

  it('asks for confirmation before deactivation and preserves the future-assignment warning', async () => {
    actions.setEmployeeActive.mockResolvedValue({ ok: true, isActive: false, futureAssignments: [{
      slotId: 'slot', date: '2026-11-01', shiftType: 'MORNING', positionName: 'מאבטח',
      periodName: 'תקופה הבאה', versionStatus: 'PUBLISHED',
    }] });
    wrap(<EmployeeActions employee={employee} positions={positions} currentUserId="manager" />);
    fireEvent.click(screen.getByRole('button', { name: 'השבתה' }));
    expect(actions.setEmployeeActive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'השבת', exact: true }));
    await waitFor(() => expect(actions.setEmployeeActive).toHaveBeenCalledWith('officer', false));
    expect(await screen.findByText('שיבוצים עתידיים שדורשים טיפול')).toBeInTheDocument();
    expect(screen.getByText(/תקופה הבאה/)).toBeInTheDocument();
  });

  it('returns to the list after confirmed deletion from the detail page', async () => {
    actions.deleteEmployee.mockResolvedValue({ ok: true });
    wrap(<EmployeeActions employee={employee} positions={positions} currentUserId="manager" />);
    fireEvent.click(screen.getByRole('button', { name: 'מחיקת עובד לצמיתות' }));
    expect(actions.deleteEmployee).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'מחק', exact: true }));
    await waitFor(() => expect(actions.push).toHaveBeenCalledWith('/manager/employees'));
    expect(actions.deleteEmployee).toHaveBeenCalledWith('officer');
  });
});
