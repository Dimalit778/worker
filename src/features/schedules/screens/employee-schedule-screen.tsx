'use client';

import { useEmployeeCurrentSchedule, useUpcomingSchedule } from '@/features/schedules/hooks';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { useAvailabilityCurrent } from '@/features/availability/hooks';
import { nextEmployeeShift } from '../overview';
import { SHIFT_LABELS } from '../constants';
import { formatDate, formatDateTime } from '@/features/periods/utils';
import { CurrentScheduleScreen } from './current-schedule-screen';

export function EmployeeScheduleScreen({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError, refetch } = useEmployeeCurrentSchedule();
  const upcoming = useUpcomingSchedule();
  const upcomingData = upcoming.data;

  const availability = useAvailabilityCurrent();
  const next = nextEmployeeShift([data, upcomingData], employeeId);

  return (
    <div className="space-y-8" dir="rtl">
      <section aria-label="העדכונים שלי" className="grid gap-4 sm:grid-cols-2">
        <Card><CardContent className="space-y-2 pt-5">
          <h1 className="text-lg font-semibold">המשמרת הבאה שלי</h1>
          {isLoading || upcoming.isLoading ? <p role="status">טוען משמרת...</p> : isError || upcoming.isError ? <div role="alert"><p>לא ניתן לטעון את המשמרת הבאה.</p><button className="min-h-11 underline" onClick={() => { void refetch(); void upcoming.refetch(); }}>ניסיון טעינה מחדש</button></div> : next ? <p className="text-xl font-bold">{formatDate(next.date)} · {SHIFT_LABELS[next.assignment.shiftType]}</p> : <p className="text-sm text-muted-foreground">אין משמרת קרובה בסידורים שפורסמו. לאחר הפרסום הבא היא תופיע כאן.</p>}
          <a href="#full-schedule" className="inline-flex min-h-11 items-center underline">לסידור המלא</a>
        </CardContent></Card>
        <Card><CardContent className="space-y-2 pt-5">
          <h2 className="text-lg font-semibold">סטטוס הגשת הזמינות</h2>
          {availability.isLoading ? <p role="status">טוען סטטוס...</p> : availability.isError ? <div role="alert"><p>לא ניתן לטעון סטטוס הגשה.</p><button className="min-h-11 underline" onClick={() => void availability.refetch()}>ניסיון טעינה מחדש</button></div> : <p>{availability.data?.period ? (availability.data.isSubmitted ? '✓ הזמינות הוגשה' : 'טרם הוגשה זמינות לתקופה הפתוחה') : (availability.data?.nextOpeningAt ? `ההגשה הבאה תיפתח ב־${formatDateTime(availability.data.nextOpeningAt)}` : 'אין תקופה פתוחה להגשות כרגע')}</p>}
          <Link href="/employee/availability" className="inline-flex min-h-11 items-center underline">הגשת זמינות</Link>
          <Link href="/employee/submissions" className="flex min-h-11 items-center text-sm underline">ההגשות וההערות שלי</Link>
        </CardContent></Card>
      </section>
      <div id="full-schedule" className="scroll-mt-6"><h2 className="mb-4 text-xl font-semibold">הסידור המלא</h2>
      <CurrentScheduleScreen
        data={data}
        isLoading={isLoading}
        isError={isError}
        loadingMessage="טוען שיבוץ..."
        errorMessage="לא ניתן לטעון השיבוץ."
        emptyStateTitle="אין שיבוץ פעיל"
        currentEmployeeId={employeeId}
        isReadOnly={true}
        defaultView="daily"
      />

      </div>
      {upcomingData ? (
        <div className="space-y-4" dir="rtl">
          <h2 className="text-xl font-bold">
            השיבוץ הבא ({formatDate(upcomingData.startDate)} - {formatDate(upcomingData.endDate)})
          </h2>
          <CurrentScheduleScreen
            data={upcomingData}
            isLoading={false}
            isError={false}
            loadingMessage=""
            errorMessage=""
            currentEmployeeId={employeeId}
            isReadOnly={true}
            defaultView="daily"
          />
        </div>
      ) : null}
    </div>
  );
}
