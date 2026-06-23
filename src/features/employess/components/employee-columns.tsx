'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

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
  onDelete: (employee: EmployeeListItem) => void;
  deletePending?: boolean;
  hideDetailLinks?: boolean;
};

export function createEmployeesColumns({
  onEdit,
  onDelete,
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
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="px-0 font-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          שם
          <ArrowUpDown className="mr-2 h-4 w-4" />
        </Button>
      ),
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
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="px-0 font-medium"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          תפקיד
          <ArrowUpDown className="mr-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const employee = row.original;

        return (
          <Badge
            variant="secondary"
            className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', POSITION_STYLE[employee.position.code])}
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
          <Badge className="rounded-full bg-green-100 text-green-800 hover:bg-green-100">פעיל</Badge>
        ) : (
          <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-600 hover:bg-slate-100">
            לא פעיל
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

              <DropdownMenuContent align="end" className="w-40">
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

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  disabled={deletePending}
                  onClick={() => onDelete(employee)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="ml-2 h-4 w-4" />
                  מחיקה
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
