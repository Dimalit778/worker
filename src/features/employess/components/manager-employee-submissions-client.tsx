'use client';

import Link from 'next/link';
import { ArrowRight, BadgeCheck, CalendarCheck2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmployeeSubmissionsPanel } from '@/features/employess/components/employee-submissions-panel';
import { useEmployeeSubmissions } from '@/features/employess/hooks';
import { cn } from '@/lib/utils';

export function ManagerEmployeeSubmissionsClient({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError } = useEmployeeSubmissions(employeeId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground" dir="rtl">טוען הגשות...</p>;
  }

  if (isError || !data || 'error' in data) {
    return <p className="text-sm text-destructive" dir="rtl">לא ניתן לטעון הגשות העובד.</p>;
  }

  const submittedCount = data.periods.filter((period) => period.isSubmitted).length;
  const selectedSlotCount = data.periods.reduce((sum, period) => sum + period.selectedSlotCount, 0);
  const openPeriods = data.periods.filter((period) => period.status === 'OPEN_FOR_SUBMISSION').length;
  const fullName = `${data.employee.firstName} ${data.employee.lastName}`.trim();

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-3 px-0 text-muted-foreground hover:bg-transparent">
            <Link href={`/manager/employees/${data.employee.id}`}>
              <ArrowRight className="size-4" aria-hidden />
              חזרה לפרטי עובד
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-lg bg-slate-900 text-base font-bold text-white">
              {data.employee.displayName.slice(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">הגשות עובד</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {fullName} · {data.employee.positionName}
              </p>
            </div>
          </div>
        </div>

        <span
          className={cn(
            'inline-flex h-9 items-center self-start rounded-md px-3 text-sm font-medium',
            data.employee.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
          )}
        >
          {data.employee.isActive ? 'פעיל' : 'לא פעיל'}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <BadgeCheck className="size-8 text-emerald-600" aria-hidden />
            <div>
              <p className="text-2xl font-bold tabular-nums">{submittedCount}</p>
              <p className="text-xs text-muted-foreground">תקופות שהוגשו</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <CalendarCheck2 className="size-8 text-amber-600" aria-hidden />
            <div>
              <p className="text-2xl font-bold tabular-nums">{selectedSlotCount}</p>
              <p className="text-xs text-muted-foreground">משמרות מסומנות</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <UserRound className="size-8 text-sky-600" aria-hidden />
            <div>
              <p className="text-2xl font-bold tabular-nums">{openPeriods}</p>
              <p className="text-xs text-muted-foreground">תקופות פתוחות</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <EmployeeSubmissionsPanel periods={data.periods} />
    </div>
  );
}
