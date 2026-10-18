'use client';

import Link from 'next/link';
import { formatDateTime } from '@/features/periods/utils';
import { Card, CardContent } from '@/components/ui/card';
import { ScheduleCalendar } from '@/features/availability/components/schedule-calendar';
import { useAvailabilityCurrent } from '@/features/availability/hooks';

export function EmployeeAvailabilityClient() {
  const { data, isLoading, isError, refetch } = useAvailabilityCurrent();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground" dir="rtl">טוען זמינות...</p>;
  }

  if (isError || !data) {
    return <div role="alert" dir="rtl"><p>לא ניתן לטעון נתוני זמינות.</p><button className="min-h-11 underline" onClick={() => void refetch()}>ניסיון טעינה מחדש</button></div>;
  }

  if (!data.period) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">הגשת זמינות</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm text-center">{data.nextOpeningAt ? `ההגשה הבאה תיפתח ב־${formatDateTime(data.nextOpeningAt)}. לאחר הפתיחה תוכלו לבחור משמרות ולהגיש זמינות.` : 'אין תקופה פתוחה כרגע. כאשר הקצין יפתח תקופה חדשה, ניתן יהיה להגיש כאן זמינות.'}</p>
          <Link href="/employee" className="mt-3 flex min-h-11 items-center justify-center underline">לסידור שלי</Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ScheduleCalendar
      key={data.period.id}
      period={data.period}
      initialEntries={data.entries}
      initialSubmitted={data.isSubmitted}
      initialNote={data.note}
      submittedEntries={data.submittedEntries}
      submittedNote={data.submittedNote}
      status={data.status}
      closesAt={data.closesAt}
      lastSavedAt={data.lastSavedAt}
    />
  );
}
