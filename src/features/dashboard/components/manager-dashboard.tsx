'use client';
import Link from 'next/link';
import { CalendarDays, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { ScheduleStatusCards } from '@/features/dashboard/components/schedule-status-cards';
import { StaffSummary } from '@/features/dashboard/components/staff-summary';
import { useManagerDashboard } from '@/features/dashboard/hooks';

type ManagerDashboardProps = {
  year: number;
};

export function ManagerDashboard({ year }: ManagerDashboardProps) {
  const { data, isLoading, isError, refetch } = useManagerDashboard(year);

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground" dir="rtl">
        טוען לוח מנהל...
      </p>
    );
  }

  if (isError || !data) {
    return (
      <div role="alert" dir="rtl"><p>לא ניתן לטעון נתוני הלוח.</p><Button variant="outline" onClick={() => void refetch()}>ניסיון טעינה מחדש</Button></div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      <ScheduleStatusCards
        activeSchedule={data.activeSchedule}
        draftSchedule={data.draftSchedule}
        warnings={data.warnings}
        submissionSummary={data.submissionSummary}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <Link
          href="/manager/schedules"
          className="group block self-start rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Card className="transition-colors group-hover:bg-muted/30">
            <CardContent className="flex items-center gap-3 p-6">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="size-4" aria-hidden="true" />
              </span>
              <h2 className="flex-1 text-lg font-medium underline underline-offset-4">כל השיבוצים</h2>
              <ChevronLeft className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
            </CardContent>
          </Card>
        </Link>
        <StaffSummary byPosition={data.staff.byPosition} totalActive={data.staff.totalActive} />
      </div>
    </div>
  );
}
