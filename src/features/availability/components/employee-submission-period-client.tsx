'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScheduleCalendar } from '@/features/availability/components/schedule-calendar';
import { availabilityEntriesToRecord } from '@/features/availability/utils';
import { useMyEmployeeSubmissions } from '@/features/availability/hooks';

export function EmployeeSubmissionPeriodClient({ periodId }: { periodId: string }) {
  const { data: periods = [], isLoading, isError } = useMyEmployeeSubmissions();
  const period = periods.find((item) => item.id === periodId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground" dir="rtl">טוען הגשה...</p>;
  }

  if (isError || !period) {
    return <p className="text-sm text-destructive" dir="rtl">לא נמצאה תקופה.</p>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <Button asChild variant="ghost" size="sm" className="px-0 text-muted-foreground hover:bg-transparent">
        <Link href="/employee/submissions">
          <ArrowRight className="size-4" aria-hidden />
          חזרה להגשות
        </Link>
      </Button>

      <ScheduleCalendar
        period={{
          id: period.id,
          name: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
          status: period.status,
        }}
        initialEntries={availabilityEntriesToRecord(period.entries)}
        initialSubmitted={period.isSubmitted}
        viewOnly
      />
    </div>
  );
}
