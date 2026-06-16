import Link from 'next/link';
import { ArrowLeft, CalendarPlus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreatePeriodForm } from '@/features/periods/components/create-period-form';
import { DraftActions } from '@/features/schedules/status/components/draft-actions';
import type { ScheduleSnapshot } from '../types';

type QuickActionsProps = {
  workingSchedule: ScheduleSnapshot | null;
  hasOpenSchedule: boolean;
};

export function QuickActions({ workingSchedule, hasOpenSchedule }: QuickActionsProps) {
  const canPublish =
    workingSchedule?.status === 'DRAFT' || workingSchedule?.status === 'LOCKED';

  return (
    <Card size="sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">פעולות מהירות</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {!hasOpenSchedule && <CreatePeriodForm triggerLabel="צור שיבוץ חדש" />}

        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/manager/draft">
            <ClipboardList className="size-4" />
            שיבוץ בהכנה
          </Link>
        </Button>

        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/manager/schedule">
            <CalendarPlus className="size-4" />
            שיבוץ פעיל
          </Link>
        </Button>

        {canPublish && workingSchedule && (
          <DraftActions scheduleId={workingSchedule.id} scheduleStatus={workingSchedule.status} />
        )}

        <Button asChild variant="ghost" size="sm" className="gap-1.5 sm:ms-auto">
          <Link href="/manager/schedules">
            כל השיבוצים
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
