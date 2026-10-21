'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useEmployeeCurrentSchedule } from '../hooks';
import { employeeHomeShifts } from '../employee-home';
import { SHIFT_LABELS } from '../constants';

type HomeShift = ReturnType<typeof employeeHomeShifts>['remaining'][number];

function ShiftDetails({ shift }: { shift: HomeShift }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="space-y-1">
        <p className="font-semibold">
          <time dateTime={shift.date}>{new Intl.DateTimeFormat('he-IL', {
            timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'long',
          }).format(new Date(`${shift.date}T12:00:00Z`))}</time>
        </p>
        <p className="text-sm text-muted-foreground">{SHIFT_LABELS[shift.shiftType]} · {shift.positionName}</p>
      </div>
      <span dir="ltr" className="font-medium tabular-nums">{shift.startTime}–{shift.endTime}</span>
    </div>
  );
}

export function EmployeeHomeScreen({ employeeId, initialNow }: { employeeId: string; initialNow: string }) {
  const { data, isLoading, isError, refetch } = useEmployeeCurrentSchedule();
  const [now, setNow] = useState(() => new Date(initialNow));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const { next, remaining } = employeeHomeShifts(data?.assignments ?? {}, employeeId, now);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">בית</h1>
        <Button asChild variant="outline">
          <Link href="/employee/schedules">
            <CalendarDays className="size-4" aria-hidden="true" />
            כל השיבוצים
          </Link>
        </Button>
      </div>
      {isLoading ? <p role="status" className="text-muted-foreground">טוען את המשמרות שלך...</p> : isError ? (
        <div role="alert" className="space-y-3">
          <p>לא ניתן לטעון את המשמרות.</p>
          <Button variant="outline" onClick={() => void refetch()}>ניסיון טעינה מחדש</Button>
        </div>
      ) : !data ? (
        <p className="text-muted-foreground">אין שיבוץ נוכחי שפורסם. המשמרות שלך יופיעו כאן לאחר הפרסום.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground">{data.scheduleName}</p>
            <Link href="/employee" className="text-sm font-medium text-primary underline underline-offset-4">לשיבוץ המלא</Link>
          </div>
          <Card className="ring-primary/40">
            <CardHeader><h2 className="text-lg font-semibold">המשמרת הקרובה שלך</h2></CardHeader>
            <CardContent>
              {next ? <ShiftDetails shift={next} /> : <p className="text-muted-foreground">אין לך משמרות נוספות שטרם התחילו בשיבוץ הנוכחי.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h2 className="text-lg font-semibold">שאר המשמרות שלך בשיבוץ הנוכחי</h2></CardHeader>
            <CardContent>
              {remaining.length ? (
                <ul className="divide-y divide-border">
                  {remaining.map(shift => <li key={shift.id} className="py-4 first:pt-0 last:pb-0"><ShiftDetails shift={shift} /></li>)}
                </ul>
              ) : <p className="text-muted-foreground">אין משמרות נוספות בשיבוץ הנוכחי.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
