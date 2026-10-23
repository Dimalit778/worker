'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SHIFT_LABELS } from '@/features/schedules/constants';
import type { EmployeeLoadRow } from '../utils';

const formatNumber = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/** Distance from the average shift count that marks an employee as an outlier. */
const OUTLIER_GAP = 2;

const SHIFT_SEGMENTS = [
  { key: 'morningShifts', label: SHIFT_LABELS.MORNING, color: 'bg-amber-300' },
  { key: 'eveningShifts', label: SHIFT_LABELS.EVENING, color: 'bg-sky-400' },
  { key: 'nightShifts', label: SHIFT_LABELS.NIGHT, color: 'bg-violet-400' },
] as const;

/** Shift and hour distribution per employee for one schedule version: summary first, then one compact row each. */
export function EmployeeLoadList({
  rows,
  highlightedEmployeeId = null,
  onSelect,
}: {
  rows: EmployeeLoadRow[];
  highlightedEmployeeId?: string | null;
  onSelect?: (employeeId: string) => void;
}) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">אין עובדים להצגה.</p>;

  const totals = rows.map((row) => row.totalShifts);
  const average = totals.reduce((sum, total) => sum + total, 0) / rows.length;
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  const scale = Math.max(1, max);
  const outlierCount = totals.filter((total) => Math.abs(total - average) >= OUTLIER_GAP).length;
  const sorted = [...rows].sort((a, b) => b.totalShifts - a.totalShifts || a.displayName.localeCompare(b.displayName, 'he'));

  return (
    <div className="space-y-4" dir="rtl">
      <dl className="grid grid-cols-3 divide-x divide-border/60 rounded-lg border border-border/60 text-center">
        <SummaryItem label="ממוצע משמרות" value={formatNumber(Math.round(average * 10) / 10)} />
        <SummaryItem label="טווח" value={<span dir="ltr">{min}–{max}</span>} />
        <SummaryItem label="חריגים" value={outlierCount} warn={outlierCount > 0} />
      </dl>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {SHIFT_SEGMENTS.map((segment) => (
          <span key={segment.key} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', segment.color)} aria-hidden />
            {segment.label}
          </span>
        ))}
      </div>

      <ul className="-mx-2.5 space-y-0.5">
        {sorted.map((row) => {
          const diff = row.totalShifts - average;
          const outlier = Math.abs(diff) >= OUTLIER_GAP;
          const selected = row.employeeId === highlightedEmployeeId;

          return (
            <li key={row.employeeId}>
              <button
                type="button"
                onClick={() => onSelect?.(row.employeeId)}
                disabled={!onSelect}
                aria-pressed={onSelect ? selected : undefined}
                className={cn(
                  'w-full rounded-md px-2.5 py-2 text-start transition-colors disabled:cursor-default',
                  onSelect && 'hover:bg-muted/50',
                  selected && 'bg-primary/15 ring-1 ring-primary/50 hover:bg-primary/20',
                )}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {row.displayName}
                    {row.roleName && <span className="ms-1.5 text-xs font-normal text-muted-foreground">{row.roleName}</span>}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                    {outlier && (
                      <span
                        className="rounded bg-amber-400/15 px-1 text-[11px] font-semibold text-amber-300"
                        dir="ltr"
                        title="סטייה מהממוצע"
                      >
                        {diff > 0 ? '+' : '−'}
                        {formatNumber(Math.round(Math.abs(diff) * 10) / 10)}
                      </span>
                    )}
                    <span className="text-sm font-semibold">{row.totalShifts}</span>
                  </span>
                </span>
                <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  {SHIFT_SEGMENTS.map((segment) => (
                    <span
                      key={segment.key}
                      className={segment.color}
                      style={{ width: `${(row[segment.key] / scale) * 100}%` }}
                    />
                  ))}
                </span>
                <span className="mt-1 block text-[11px] tabular-nums text-muted-foreground">
                  {SHIFT_SEGMENTS.map((segment) => `${segment.label} ${row[segment.key]}`).join(' · ')}
                  {' · '}
                  {formatNumber(row.hours)} שעות · {row.weekendShifts} סופ״ש
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SummaryItem({ label, value, warn = false }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div className="px-2 py-2.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 text-lg font-bold tabular-nums leading-tight', warn ? 'text-amber-300' : 'text-foreground')}>{value}</dd>
    </div>
  );
}
