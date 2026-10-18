'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCurrentSchedule } from '@/features/schedules/hooks';
import { todayShortages } from '@/features/schedules/overview';
import { SHIFT_LABELS } from '@/features/schedules/constants';
import { AlertsSection } from './alerts-section';

import { ScheduleStatusCards } from '@/features/dashboard/components/schedule-status-cards';
import { StaffSummary } from '@/features/dashboard/components/staff-summary';
import { YearSchedulesSection } from '@/features/dashboard/components/year-schedules-section';
import { useManagerDashboard } from '@/features/dashboard/hooks';
import type { MonthSelection } from '@/features/dashboard/utils';

type ManagerDashboardProps = {
  year: number;
  initialSelection: MonthSelection;
};

export function ManagerDashboard({ year, initialSelection }: ManagerDashboardProps) {
  const { data, isLoading, isError, refetch } = useManagerDashboard(year);
  const current = useCurrentSchedule();
  const shortages = current.data ? todayShortages(current.data) : null;

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
      <section className="space-y-3" aria-labelledby="attention-title">
        <h1 id="attention-title" className="text-xl font-semibold">לטיפול היום</h1>
        <Card><CardContent className="space-y-3 pt-5">
          <h2 className="font-semibold">חוסרים היום</h2>
          {current.isLoading ? <p role="status">טוען כיסוי משמרות...</p> : current.isError ? <div role="alert"><p>לא ניתן לטעון חוסרים.</p><Button variant="outline" onClick={() => void current.refetch()}>ניסיון טעינה מחדש</Button></div> : shortages === null ? <p className="text-sm text-muted-foreground">אין סידור שפורסם להיום. הכיסוי יוצג לאחר פרסום סידור לתאריך זה.</p> : shortages.length ? <><p className="font-semibold text-amber-200">{shortages.length === 1 ? 'חסר עובד אחד' : `חסרים ${shortages.length} עובדים`}</p><ul className="flex flex-wrap gap-2">{shortages.map(slot => <li key={slot.key} className="rounded-md bg-amber-950 px-3 py-2 text-sm text-amber-200">{SHIFT_LABELS[slot.shiftType]} · חסר {slot.positionName}</li>)}</ul></> : <p>✓ כל התקנים להיום מאוישים</p>}
          <Link className="inline-flex min-h-11 items-center underline" href="/manager/schedule">ללוח המשמרות</Link>
        </CardContent></Card>
        <AlertsSection warnings={data.warnings} submissionSummary={data.submissionSummary} />
      </section>
      <ScheduleStatusCards
        activeSchedule={data.activeSchedule}
        draftSchedule={data.draftSchedule}
        warnings={data.warnings}
        submissionSummary={data.submissionSummary}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <YearSchedulesSection yearSchedules={data.yearSchedules} initialSelection={initialSelection} />
        <StaffSummary byPosition={data.staff.byPosition} totalActive={data.staff.totalActive} />
      </div>
    </div>
  );
}
