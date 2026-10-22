'use client';

import { ArrowLeftRight, Minus, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useScheduleChangeLog } from '@/features/schedules/hooks';
import { EXTENSION_REASON_PREFIX } from '@/features/periods/extension';
import type { AssignmentChangeKind } from './format';

type ChangeLogListProps = {
  scheduleId: string;
  versionId: string | null;
  revision: number;
};

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

function ChangeActionIcon({ kind }: { kind: AssignmentChangeKind }) {
  const className = 'mt-0.5 size-3.5 shrink-0';
  if (kind === 'joined') {
    return <Plus className={`${className} text-emerald-600`} aria-hidden />;
  }
  if (kind === 'left') {
    return <Minus className={`${className} text-destructive`} aria-hidden />;
  }
  return <ArrowLeftRight className={`${className} text-muted-foreground`} aria-hidden />;
}

export function ChangeLogList({ scheduleId, versionId, revision }: ChangeLogListProps) {
  const { data: entries, isError } = useScheduleChangeLog(scheduleId, versionId, revision);
  const visibleEntries = entries?.filter((entry) => !(entry.changeType === 'UPDATE' && entry.message?.startsWith(EXTENSION_REASON_PREFIX)));
  const message = isError ? 'לא ניתן לטעון את השינויים.' : entries ? 'אין שינויים רשומים.' : 'טוען שינויים...';

  return (
    <Card size="sm" dir="rtl">
      <CardHeader>
        <CardTitle>שינויים בשיבוץ</CardTitle>
      </CardHeader>
      <CardContent>
        {visibleEntries?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">מתי</TableHead>
                <TableHead className="text-right">שונה על ידי</TableHead>
                <TableHead className="text-right">שינוי</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEntries.map((entry) => {
                const changeText = entry.summary
                  ? [entry.summary, entry.shiftDateLabel].filter(Boolean).join(' · ')
                  : (entry.message ?? '—');

                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatChangeDate(entry.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs font-medium whitespace-nowrap">{entry.changedByName}</TableCell>
                    <TableCell className="text-xs whitespace-normal">
                      {entry.summary && entry.actionKind ? (
                        <span className="flex items-start gap-2">
                          <ChangeActionIcon kind={entry.actionKind} />
                          <span>{changeText}</span>
                        </span>
                      ) : (
                        changeText
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className={`py-4 text-center text-sm ${isError ? 'text-destructive' : 'text-muted-foreground'}`}>{message}</p>
        )}
      </CardContent>
    </Card>
  );
}
