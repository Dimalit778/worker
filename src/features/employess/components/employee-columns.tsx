'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, MailPlus, MoreHorizontal, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';

import { cn } from '@/lib/utils';
import { EmployeeListItem } from '@/features/employess/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { POSITION_STYLE } from '../utils';

type EmployeesColumnsProps = {
  onEdit: (employee: EmployeeListItem) => void;
  onDelete?: (employee: EmployeeListItem) => void;
  onToggleActive?: (employee: EmployeeListItem) => void;
  onResendInvite: (employee: EmployeeListItem) => void;
  deletePending?: boolean;
  hideDetailLinks?: boolean;
};

export function createEmployeesColumns({
  onEdit,
  onDelete,
  onToggleActive,
  onResendInvite,
  deletePending,
  hideDetailLinks = false,
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
      accessorKey: 'isActive',
      header: 'סטטוס',
      cell: ({ row }) => {
        const isActive = row.original.isActive;

        return isActive ? (
          <Badge className="rounded-full bg-green-950 text-green-200 hover:bg-green-950">פעיל</Badge>
        ) : (
          <Badge variant="secondary" className="rounded-full bg-secondary text-muted-foreground hover:bg-secondary">
            מושבת
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const employee = row.original;

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <span className="sr-only">פתח תפריט פעולות</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>פעולות</DropdownMenuLabel>

                {!hideDetailLinks && (
                  <DropdownMenuItem asChild>
                    <Link href={`/manager/employees/${employee.id}`}>
                      <Eye className="ml-2 h-4 w-4" />
                      צפייה
                    </Link>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={() => onEdit(employee)}>
                  <Pencil className="ml-2 h-4 w-4" />
                  עריכה
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => onResendInvite(employee)}>
                  <MailPlus className="ml-2 h-4 w-4" />
                  שליחת הזמנה מחדש
                </DropdownMenuItem>
                {onToggleActive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={deletePending}
                      onClick={() => onToggleActive(employee)}
                      className={employee.isActive ? 'text-destructive focus:text-destructive' : undefined}
                    >
                      {employee.isActive ? (
                        <UserX className="ml-2 h-4 w-4" />
                      ) : (
                        <UserCheck className="ml-2 h-4 w-4" />
                      )}
                      {employee.isActive ? 'השבתה' : 'הפעלה מחדש'}
                    </DropdownMenuItem>
                  </>
                )}

                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={deletePending}
                      onClick={() => onDelete(employee)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="ml-2 h-4 w-4" />
                      מחיקה
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
