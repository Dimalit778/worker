'use client';

import { ArrowLeftRight, Minus, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useScheduleChangeLog } from '@/features/schedules/hooks';
import { EXTENSION_REASON_PREFIX } from '@/features/periods/extension';
import { AUTO_REGEN_CHANGE_REASON, type AssignmentChangeKind } from './format';
import type { ScheduleChangeLogEntry } from './queries';

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
  const className = 'size-3.5 shrink-0';
  if (kind === 'joined') {
    return <Plus className={`${className} text-emerald-600`} aria-hidden />;
  }
  if (kind === 'left') {
    return <Minus className={`${className} text-destructive`} aria-hidden />;
  }
  return <ArrowLeftRight className={`${className} text-muted-foreground`} aria-hidden />;
}

function isNoiseChange(entry: { changeType: string; message: string | null }) {
  if (entry.changeType === 'UPDATE' && entry.message?.startsWith(EXTENSION_REASON_PREFIX)) return true;
  if (entry.message === AUTO_REGEN_CHANGE_REASON) return true;
  return false;
}

function ChangeCell({ entry }: { entry: ScheduleChangeLogEntry }) {
  if (entry.summary && entry.actionKind) {
    return (
      <span className="flex items-center gap-2">
        <ChangeActionIcon kind={entry.actionKind} />
        <span>{entry.summary}</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <span className="size-3.5 shrink-0" aria-hidden />
      <span>{entry.message ?? '—'}</span>
    </span>
  );
}

/** Shared tracks so header labels and row values share the same edges. */
const metaClusterClass = 'grid w-max grid-cols-[9.5rem_4.5rem] items-center gap-x-3';
const detailClusterClass = 'grid w-max grid-cols-[7.5rem_3.25rem_10.5rem] items-center gap-x-3';

export function ChangeLogList({ scheduleId, versionId, revision }: ChangeLogListProps) {
  const { data: entries, isError } = useScheduleChangeLog(scheduleId, versionId, revision);
  const visibleEntries = entries?.filter((entry) => !isNoiseChange(entry));
  const message = isError ? 'לא ניתן לטעון את השינויים.' : entries ? 'אין שינויים רשומים.' : 'טוען שינויים...';

  return (
    <Card size="sm" dir="rtl">
      <CardHeader>
        <CardTitle>שינויים בשיבוץ</CardTitle>
      </CardHeader>
      <CardContent>
        {visibleEntries?.length ? (
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[30%]" />
              <col className="w-[70%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">
                  <div className={metaClusterClass}>
                    <span>מתי</span>
                    <span>שונה על ידי</span>
                  </div>
                </TableHead>
                <TableHead className="text-right">
                  <div className={detailClusterClass}>
                    <span className="flex items-center gap-2">
                      <span className="size-3.5 shrink-0" aria-hidden />
                      <span>שינוי</span>
                    </span>
                    <span>משמרת</span>
                    <span>תאריך</span>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="align-middle text-xs">
                    <div className={metaClusterClass}>
                      <span className="whitespace-nowrap text-muted-foreground">
                        {formatChangeDate(entry.createdAt)}
                      </span>
                      <span className="truncate font-medium whitespace-nowrap">{entry.changedByName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="align-middle text-xs">
                    <div className={detailClusterClass}>
                      <span className="text-foreground">
                        <ChangeCell entry={entry} />
                      </span>
                      <span className="whitespace-nowrap text-muted-foreground">
                        {entry.shiftLabel ?? ''}
                      </span>
                      <span className="whitespace-nowrap text-muted-foreground">
                        {entry.shiftDateLabel ?? ''}
                      </span>
                    </div>
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
