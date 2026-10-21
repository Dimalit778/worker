'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, MailPlus, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';

import { cn } from '@/lib/utils';
import { EmployeeListItem } from '@/features/employess/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { POSITION_STYLE } from '../utils';

type EmployeesColumnsProps = {
  onEdit: (employee: EmployeeListItem) => void;
  onDelete?: (employee: EmployeeListItem) => void;
  onToggleActive?: (employee: EmployeeListItem) => void;
  onResendInvite: (employee: EmployeeListItem) => void;
  deletePending?: boolean;
  hideDetailLinks?: boolean;
  currentUserId?: string;
};

export function createEmployeesColumns({
  onEdit,
  onDelete,
  onToggleActive,
  onResendInvite,
  deletePending,
  hideDetailLinks = false,
  currentUserId,
}: EmployeesColumnsProps): ColumnDef<EmployeeListItem>[] {
  return [
    {
      id: 'index',
      header: '#',
      cell: ({ row }) => <span className="text-muted-foreground">{row.index + 1}</span>,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: 'name',
      accessorFn: (employee) => `${employee.firstName} ${employee.lastName}`.trim(),
      header: 'שם',
      cell: ({ row }) => {
        const employee = row.original;
        const name = `${employee.firstName} ${employee.lastName}`.trim();

        if (hideDetailLinks) {
          return <span className="font-medium">{name}</span>;
        }

        return (
          <Link
            href={`/manager/employees/${employee.id}`}
            className="font-medium hover:text-primary hover:underline underline-offset-4"
          >
            {name}
          </Link>
        );
      },
    },
    {
      id: 'position',
      accessorFn: (employee) => employee.position.name,
      header: 'תפקיד',
      cell: ({ row }) => {
        const employee = row.original;

        return (
          <Badge
            variant="secondary"
            className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', POSITION_STYLE[employee.position.rank])}
          >
            {employee.position.name}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'phone',
      header: 'טלפון',
      cell: ({ row }) => row.original.phone || '-',
    },
    {
      accessorKey: 'email',
      header: 'אימייל',
      cell: ({ row }) => row.original.email || '-',
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const employee = row.original;

        return (
          <div className="flex items-center justify-end gap-1">
            {!hideDetailLinks && (
              <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="צפייה">
                <Link href={`/manager/employees/${employee.id}`} aria-label="צפייה">
                  <Eye className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="עריכה"
              aria-label="עריכה"
              onClick={() => onEdit(employee)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="שליחת הזמנה מחדש"
              aria-label="שליחת הזמנה מחדש"
              onClick={() => onResendInvite(employee)}
            >
              <MailPlus className="h-4 w-4" />
            </Button>
            {onToggleActive && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={deletePending}
                title={employee.isActive ? 'השבתה' : 'הפעלה מחדש'}
                aria-label={employee.isActive ? 'השבתה' : 'הפעלה מחדש'}
                onClick={() => onToggleActive(employee)}
              >
                {employee.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
              </Button>
            )}
            {onDelete && employee.id !== currentUserId && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                disabled={deletePending}
                title="מחיקת עובד לצמיתות"
                aria-label="מחיקת עובד לצמיתות"
                onClick={() => onDelete(employee)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];
}
