'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PERIOD_STATUS_HE, STATUS_BADGE } from '@/features/periods/constants';
import { formatDate } from '@/features/periods/utils';
import type { PeriodSummary } from '@/features/periods/types';
import { cn } from '@/lib/utils';
import { filterSchedulesByMonth, formatMonthLabel, shiftMonth, type MonthSelection } from '../utils';

const HEBREW_MONTHS = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;
  const label = new Date(Date.UTC(2024, index, 1)).toLocaleDateString('he-IL', {
    month: 'long',
    timeZone: 'UTC',
  });
  return { value: String(month), label };
});

type YearSchedulesSectionProps = {
  yearSchedules: PeriodSummary[];
  initialSelection: MonthSelection;
};

function buildYearOptions(selection: MonthSelection, baseYear: number, schedules: PeriodSummary[]) {
  const years = new Set<number>([selection.year, baseYear]);

  for (const schedule of schedules) {
    years.add(Number(schedule.startDate.slice(0, 4)));
    years.add(Number(schedule.endDate.slice(0, 4)));
  }

  const sorted = [...years].sort((a, b) => a - b);
  const min = sorted[0] ?? selection.year - 1;
  const max = sorted[sorted.length - 1] ?? selection.year + 1;

  const options: number[] = [];
  for (let year = min; year <= max; year++) {
    options.push(year);
  }

  return options;
}

function submissionProgress(schedule: PeriodSummary) {
  if (schedule.totalEmployees === 0) return 0;
  return Math.round((schedule.submittedCount / schedule.totalEmployees) * 100);
}

export function YearSchedulesSection({ yearSchedules, initialSelection }: YearSchedulesSectionProps) {
  const router = useRouter();
  const [selection, setSelection] = useState(initialSelection);

  useEffect(() => {
    setSelection(initialSelection);
  }, [initialSelection]);

  const yearOptions = useMemo(
    () => buildYearOptions(selection, initialSelection.year, yearSchedules),
    [selection, initialSelection.year, yearSchedules],
  );

  const monthSchedules = useMemo(
    () => filterSchedulesByMonth(yearSchedules, selection.year, selection.month),
    [yearSchedules, selection.year, selection.month],
  );

  function updateSelection(next: MonthSelection) {
    if (next.year !== selection.year) {
      router.replace(`/manager?month=${next.param}`);
      return;
    }

    setSelection(next);
    window.history.replaceState(null, '', `/manager?month=${next.param}`);
  }

  function navigateMonth(delta: number) {
    updateSelection(shiftMonth(selection.year, selection.month, delta));
  }

  function handleYearChange(value: string) {
    const year = Number(value);
    const param = `${year}-${String(selection.month).padStart(2, '0')}`;
    updateSelection({ year, month: selection.month, param });
  }

  function handleMonthChange(value: string) {
    const month = Number(value);
    const param = `${selection.year}-${String(month).padStart(2, '0')}`;
    updateSelection({ year: selection.year, month, param });
  }

  return (
    <section className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-4 border-b border-border/60 bg-muted/20 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="size-4" />
              </div>
              <div>
                <h2 className="text-lg font-medium">סידורי עבודה</h2>
                <p className="text-sm text-muted-foreground">{formatMonthLabel(selection.year, selection.month)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-border/60 bg-background p-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="חודש קודם"
                  className="size-8"
                  onClick={() => navigateMonth(-1)}
                >
                  <ChevronRight className="size-4" />
                </Button>

                <Select value={String(selection.month)} onValueChange={handleMonthChange}>
                  <SelectTrigger size="sm" className="min-w-28 border-0 bg-transparent shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HEBREW_MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="חודש הבא"
                  className="size-8"
                  onClick={() => navigateMonth(1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
              </div>

              <Select value={String(selection.year)} onValueChange={handleYearChange}>
                <SelectTrigger size="sm" className="min-w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {monthSchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <CalendarDays className="size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">אין שיבוצים בחודש זה</p>
              <p className="text-xs text-muted-foreground">נסו לבחור חודש או שנה אחרים</p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {monthSchedules.map((schedule) => {
                const progress = submissionProgress(schedule);

                return (
                  <li key={schedule.id}>
                    <Link
                      href={`/manager/schedules/${schedule.id}`}
                      className="group flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold group-hover:text-primary">{schedule.name}</p>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[11px] font-medium',
                              STATUS_BADGE[schedule.status],
                            )}
                          >
                            {PERIOD_STATUS_HE[schedule.status]}
                          </span>
                        </div>

                        <p className="text-sm text-muted-foreground">
                          {formatDate(schedule.startDate)} – {formatDate(schedule.endDate)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-4 sm:w-44">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">הגשות</span>
                            <span className="font-medium tabular-nums">
                              {schedule.submittedCount}/{schedule.totalEmployees}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        <ChevronLeft className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
