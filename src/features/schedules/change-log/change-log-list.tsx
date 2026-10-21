'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useScheduleChangeLog } from '@/features/schedules/hooks';

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
  scheduleId: string;
  versionId: string | null;
  revision: number;
};

export function ChangeLogList({ scheduleId, versionId, revision }: ChangeLogListProps) {
  const { data: entries, isError } = useScheduleChangeLog(scheduleId, versionId, revision);
  const message = isError ? 'לא ניתן לטעון את השינויים.' : entries ? 'אין שינויים רשומים.' : 'טוען שינויים...';

  return (
    <Card size="sm" dir="rtl">
      <CardHeader>
        <CardTitle>שינויים בשיבוץ</CardTitle>
      </CardHeader>
      <CardContent>
        {entries?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">מתי</TableHead>
                <TableHead className="text-right">מי</TableHead>
                <TableHead className="text-right">שינוי</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatChangeDate(entry.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs font-medium">{entry.changedByName}</TableCell>
                  <TableCell className="text-xs">
                    {entry.message ?? '—'}
                    {entry.versionNumber && <span> · גרסה {entry.versionNumber}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className={`py-4 text-center text-sm ${isError ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>
        )}
      </CardContent>
    </Card>
  );
}
