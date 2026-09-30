'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ScheduleChangeLogGroup } from './queries';

function formatChangeDate(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

type ChangeLogListProps = {
  groups: ScheduleChangeLogGroup[];
};

export function ChangeLogList({ groups }: ChangeLogListProps) {
  if (groups.length === 0) {
    return (
      <Card size="sm" dir="rtl">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          אין שינויים רשומים.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {groups.map((group) => (
        <Card key={group.scheduleId} size="sm">
          <CardHeader>
            <CardTitle>{group.scheduleName}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">מתי</TableHead>
                  <TableHead className="text-right">מי</TableHead>
                  <TableHead className="text-right">שינוי</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatChangeDate(entry.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs font-medium">{entry.changedByName}</TableCell>
                    <TableCell className="text-xs">{entry.message ?? '—'}{entry.versionNumber && <span> · גרסה {entry.versionNumber}</span>}{entry.reason && <p className="mt-1 text-muted-foreground">סיבה: {entry.reason}</p>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
