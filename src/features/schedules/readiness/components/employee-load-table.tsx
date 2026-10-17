'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { EmployeeLoadRow } from '../utils';

const formatHours = (hours: number) => (Number.isInteger(hours) ? String(hours) : hours.toFixed(1));

/** Shift and hour distribution per employee for one schedule version. */
export function EmployeeLoadTable({ rows }: { rows: EmployeeLoadRow[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">אין עובדים להצגה.</p>;

  return (
    <div className="max-h-96 overflow-auto" dir="rtl">
      <Table className="text-right">
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">עובד</TableHead>
            <TableHead className="text-center">משמרות</TableHead>
            <TableHead className="text-center">בוקר</TableHead>
            <TableHead className="text-center">ערב</TableHead>
            <TableHead className="text-center">לילה</TableHead>
            <TableHead className="text-center">סופ״ש</TableHead>
            <TableHead className="text-center">שעות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.employeeId}>
              <TableCell className="text-right">
                <span className="font-medium">{row.displayName}</span>
                {row.roleName && <span className="ms-2 text-xs text-muted-foreground">{row.roleName}</span>}
              </TableCell>
              <TableCell className="text-center font-semibold tabular-nums">{row.totalShifts}</TableCell>
              <TableCell className="text-center tabular-nums">{row.morningShifts}</TableCell>
              <TableCell className="text-center tabular-nums">{row.eveningShifts}</TableCell>
              <TableCell className="text-center tabular-nums">{row.nightShifts}</TableCell>
              <TableCell className="text-center tabular-nums">{row.weekendShifts}</TableCell>
              <TableCell className="text-center tabular-nums">{formatHours(row.hours)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
