import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { flexRender, type CellContext } from '@tanstack/react-table';
import { createEmployeesColumns } from '@/features/employess/components/employee-columns';
import type { EmployeeListItem } from '@/features/employess/types';

const employee: EmployeeListItem = {
  id: 'officer', firstName: 'קצין', lastName: 'מתקן', displayName: 'קצין מתקן',
  email: 'officer@example.test', phone: null, isReligious: false, isActive: true,
  position: { id: 'manager-role', name: 'קצין מתקן', rank: 1 },
};

function renderActions(currentUserId?: string, row = employee) {
  const actions = createEmployeesColumns({
    onEdit: vi.fn(), onDelete: vi.fn(), onResendInvite: vi.fn(), currentUserId,
  }).find(column => column.id === 'actions')!;
  return renderToStaticMarkup(flexRender(actions.cell, {
    row: { original: row },
  } as CellContext<EmployeeListItem, unknown>));
}

describe('employee deletion button', () => {
  it('hides deletion on the signed-in officer’s row while keeping edit available', () => {
    const html = renderActions('officer');
    expect(html).not.toContain('aria-label="מחיקת עובד לצמיתות"');
    expect(html).toContain('aria-label="עריכה"');
  });

  it('keeps deletion available on another employee’s row', () => {
    expect(renderActions('officer', { ...employee, id: 'other-employee' }))
      .toContain('aria-label="מחיקת עובד לצמיתות"');
  });

  it('preserves deletion in admin tables without a current-user prop', () => {
    expect(renderActions()).toContain('aria-label="מחיקת עובד לצמיתות"');
  });
});
