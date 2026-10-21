'use client';

import { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PeriodScheduleStatus } from '@/features/schedules/period-status';
import { ScheduleCalendar } from './schedule-calendar';
import type { AvailabilityStatus } from '../utils';

export type SubmissionsPeriodPayload = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PeriodScheduleStatus;
  isSubmitted: boolean;
  submittedAt: string | null;
  submissionStatus: AvailabilityStatus;
  entries: Record<string, boolean | 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE'>;
  selectedSlotCount: number;
};

type Props = {
  periods: SubmissionsPeriodPayload[];
};

/** Short range label: 11/10 - 24/10 */
function shortDateRange(startDate: string, endDate: string): string {
  const short = (iso: string) => {
    const [, month, day] = iso.split('-');
    return `${day}/${month}`;
  };
  return `${short(startDate)} - ${short(endDate)}`;
}

function periodYear(period: SubmissionsPeriodPayload): number {
  return Number(period.startDate.slice(0, 4));
}

function periodInYear(period: SubmissionsPeriodPayload, year: number): boolean {
  const startYear = Number(period.startDate.slice(0, 4));
  const endYear = Number(period.endDate.slice(0, 4));
  return startYear === year || endYear === year;
}

/** Last submission by the employee; falls back to newest period by start date. */
function defaultPeriodId(periods: SubmissionsPeriodPayload[]): string | null {
  if (periods.length === 0) return null;

  const submitted = periods
    .filter((period) => period.submittedAt != null)
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

  if (submitted[0]) return submitted[0].id;

  return [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]?.id ?? null;
}

function pickPeriodInYear(
  periodsInYear: SubmissionsPeriodPayload[],
  preferredId: string | null,
): string | null {
  if (periodsInYear.length === 0) return null;
  if (preferredId && periodsInYear.some((period) => period.id === preferredId)) {
    return preferredId;
  }
  return defaultPeriodId(periodsInYear);
}

export function SubmissionsTable({ periods }: Props) {
  const initialId = defaultPeriodId(periods);
  const initialPeriod = periods.find((period) => period.id === initialId) ?? periods[0] ?? null;

  const [selectedYear, setSelectedYear] = useState(
    initialPeriod ? periodYear(initialPeriod) : new Date().getFullYear(),
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialId);

  const years = useMemo(() => {
    const set = new Set<number>();
    for (const period of periods) {
      set.add(Number(period.startDate.slice(0, 4)));
      set.add(Number(period.endDate.slice(0, 4)));
    }
    return [...set].sort((a, b) => b - a);
  }, [periods]);

  const periodsInYear = useMemo(
    () =>
      periods
        .filter((period) => periodInYear(period, selectedYear))
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [periods, selectedYear],
  );

  const selected = useMemo(
    () => periods.find((period) => period.id === selectedId) ?? null,
    [periods, selectedId],
  );

  function handleYearChange(value: string) {
    const year = Number(value);
    setSelectedYear(year);
    const inYear = periods.filter((period) => periodInYear(period, year));
    setSelectedId(pickPeriodInYear(inYear, selectedId));
  }

  function handlePeriodChange(value: string) {
    setSelectedId(value);
    const period = periods.find((entry) => entry.id === value);
    if (period) setSelectedYear(periodYear(period));
  }

  if (periods.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" dir="rtl">
        אין תקופות עם הגשות זמינות.
      </p>
    );
  }

  const periodSelectValue =
    selectedId && periodsInYear.some((period) => period.id === selectedId) ? selectedId : undefined;

  return (
    <div className="space-y-6" dir="rtl">
      {/* RTL: first = visual right (year), second = visual left (period dates). */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-36 space-y-1 sm:w-40">
          <label htmlFor="submissions-year" className="text-xs font-medium text-muted-foreground">
            שנה
          </label>
          <Select value={String(selectedYear)} onValueChange={handleYearChange}>
            <SelectTrigger id="submissions-year" className="w-full bg-card">
              <SelectValue placeholder="בחירת שנה" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-44 space-y-1 sm:w-52">
          <label htmlFor="submissions-period" className="text-xs font-medium text-muted-foreground">
            תאריכי שיבוץ
          </label>
          <Select
            value={periodSelectValue}
            onValueChange={handlePeriodChange}
            disabled={periodsInYear.length === 0}
          >
            <SelectTrigger id="submissions-period" className="w-full bg-card">
              <SelectValue placeholder={periodsInYear.length === 0 ? 'אין שיבוצים' : 'בחירת תאריכים'} />
            </SelectTrigger>
            <SelectContent>
              {periodsInYear.map((period) => (
                <SelectItem key={period.id} value={period.id}>
                  {shortDateRange(period.startDate, period.endDate)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected ? (
        <ScheduleCalendar
          key={selected.id}
          period={{
            id: selected.id,
            name: selected.name,
            startDate: selected.startDate,
            endDate: selected.endDate,
            status: selected.status,
          }}
          initialEntries={selected.entries}
          initialSubmitted={selected.isSubmitted}
          status={selected.submissionStatus}
          viewOnly
          showStatus={false}
        />
      ) : (
        <p className="text-sm text-muted-foreground">אין שיבוצים בשנה שנבחרה.</p>
      )}
    </div>
  );
}
