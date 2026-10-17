'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  Clock,
  History,
  Mail,
  MapPin,
  Moon,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEmployeeDetail } from '@/features/employess/hooks';
import { cn } from '@/lib/utils';

const SHIFT_LABELS: Record<string, string> = {
  MORNING: 'בוקר',
  EVENING: 'ערב',
  NIGHT: 'לילה',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(value),
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-background p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-0.5  text-sm font-medium text-wrap">{value}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className={cn('mb-3 h-1.5 w-12 rounded-full', tone)} />
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export function ManagerEmployeeDetailClient({ employeeId }: { employeeId: string }) {
  const { data, isLoading, isError } = useEmployeeDetail(employeeId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground" dir="rtl">טוען פרטי עובד...</p>;
  }

  if (isError || !data || 'error' in data) {
    return <p className="text-sm text-destructive" dir="rtl">לא ניתן לטעון פרטי העובד.</p>;
  }

  const { employee, stats, recentAssignments, fairnessRecords } = data;
  const fullName = `${employee.firstName} ${employee.lastName}`.trim();

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="mb-3 px-0 text-muted-foreground hover:bg-transparent">
            <Link href="/manager/employees">
              <ArrowRight className="size-4" aria-hidden />
              חזרה לעובדים
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-lg bg-slate-900 text-lg font-bold text-white">
              {employee.displayName.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold">{fullName}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{employee.displayName}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/manager/employees/${employee.id}/submissions`}>
              <CalendarCheck2 className="size-4" aria-hidden />
              הגשות עובד
            </Link>
          </Button>
          <span
            className={cn(
              'inline-flex h-9 items-center rounded-md px-3 text-sm font-medium',
              employee.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600',
            )}
          >
            {employee.isActive ? 'פעיל' : 'מושבת'}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="הגשות מלאות" value={stats.submissions} tone="bg-emerald-500" />
        <StatCard label="רשומות זמינות" value={stats.totalAvailabilityRecords} tone="bg-sky-500" />
        <StatCard label="משמרות מסומנות" value={stats.selectedSlots} tone="bg-amber-500" />
        <StatCard label="שיבוצים" value={stats.assignments} tone="bg-violet-500" />
        <StatCard label="שיבוצים ידניים" value={stats.manualAssignments} tone="bg-rose-500" />
        <StatCard label="אזהרות" value={stats.warnings} tone="bg-slate-700" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="size-4" aria-hidden />
                פרטי עובד
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow label="שם פרטי" value={employee.firstName} icon={UserRound} />
                <InfoRow label="שם משפחה" value={employee.lastName} icon={UserRound} />
                <InfoRow label="שם תצוגה" value={employee.displayName} icon={BadgeCheck} />
                <InfoRow
                  label="תפקיד"
                  value={`${employee.position.name} (${employee.position.rank})`}
                  icon={ShieldCheck}
                />
                <InfoRow label="טלפון" value={employee.phone || 'לא הוזן'} icon={Phone} />
                <InfoRow label="אימייל" value={employee.email || 'לא הוזן'} icon={Mail} />
                <InfoRow label="שומר שבת" value={employee.isReligious ? 'כן' : 'לא'} icon={Moon} />
                <InfoRow label="עודכן לאחרונה" value={formatDate(employee.updatedAt)} icon={Clock} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4" aria-hidden />
                שיבוצים אחרונים
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentAssignments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-xl text-sm">
                    <thead className="bg-muted/50 text-right text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">תאריך</th>
                        <th className="px-4 py-3 font-medium">משמרת</th>
                        <th className="px-4 py-3 font-medium">תקופה</th>
                        <th className="px-4 py-3 font-medium">תפקיד</th>
                        <th className="px-4 py-3 font-medium">מקור</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAssignments.map((assignment) => (
                        <tr key={assignment.id} className="border-t">
                          <td className="px-4 py-3">{formatDate(assignment.date)}</td>
                          <td className="px-4 py-3">{SHIFT_LABELS[assignment.shiftType] ?? assignment.shiftType}</td>
                          <td className="px-4 py-3">{assignment.periodName}</td>
                          <td className="px-4 py-3">{assignment.positionName}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'rounded-md px-2 py-1 text-xs font-medium',
                                assignment.isManualOverride
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-emerald-50 text-emerald-700',
                              )}
                            >
                              {assignment.isManualOverride ? 'ידני' : 'אוטומטי'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-6 py-8 text-sm text-muted-foreground">אין שיבוצים לעובד זה.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-4" aria-hidden />
                שיוך מערכת
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="בית משפט" value={`${employee.court.name} (${employee.court.code})`} icon={MapPin} />
              <InfoRow label="מחוז" value={employee.court.regionName} icon={MapPin} />
              <InfoRow
                label="חשבון משתמש"
                value={employee.user ? (employee.user.mustChangePassword ? 'נדרש שינוי סיסמה' : 'פעיל') : 'אין חשבון'}
                icon={ShieldCheck}
              />
              <InfoRow label="נוצר בתאריך" value={formatDate(employee.createdAt)} icon={Clock} />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">איזון שיבוצים</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {fairnessRecords.length > 0 ? (
                fairnessRecords.map((record) => (
                  <div key={record.id} className="rounded-lg border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{record.periodName}</p>
                      <p className="text-lg font-bold tabular-nums">{record.totalShifts}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-800">
                        בוקר {record.morningShifts}
                      </span>
                      <span className="rounded-md bg-sky-50 px-2 py-1 text-sky-800">ערב {record.eveningShifts}</span>
                      <span className="rounded-md bg-indigo-50 px-2 py-1 text-indigo-800">
                        לילה {record.nightShifts}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
                        סופ״ש {record.weekendShifts}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">אין עדיין נתוני איזון.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
