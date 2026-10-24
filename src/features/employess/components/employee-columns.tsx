'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';

import { cn } from '@/lib/utils';
import type { EmployeeListItem, PositionOption } from '@/features/employess/types';
import { Badge } from '@/components/ui/badge';

import { POSITION_STYLE } from '../utils';
import { EmployeeActions } from './employee-actions';

type EmployeesColumnsProps = {
  positions: PositionOption[];
  facilityId?: string;
  currentUserId?: string;
};

export function createEmployeesColumns({
  positions,
  facilityId,
  currentUserId,
}: EmployeesColumnsProps): ColumnDef<EmployeeListItem>[] {
  const hideDetailLinks = Boolean(facilityId);
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
    ...(facilityId ? [{
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => (
        <EmployeeActions employee={row.original} positions={positions} facilityId={facilityId}
          currentUserId={currentUserId} compact />
      ),
    } satisfies ColumnDef<EmployeeListItem>] : []),
  ];
}
