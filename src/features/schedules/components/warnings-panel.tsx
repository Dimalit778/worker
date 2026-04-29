'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SHIFT_LABELS } from '@/features/shift-assignments/constants';
import type { ScheduleWarningSummary } from '@/features/shift-assignments/types';
import type { WarningSeverity, WarningType } from '@/generated/prisma/client';

type Props = {
  warnings: ScheduleWarningSummary[];
};

const SEVERITIES: WarningSeverity[] = ['ERROR', 'WARNING', 'INFO'];
const DEFAULT_VISIBLE_COUNT = 10;

const SEVERITY_LABELS: Record<WarningSeverity, string> = {
  ERROR: 'שגיאות',
  WARNING: 'אזהרות',
  INFO: 'מידע',
};

const WARNING_TYPE_LABELS: Record<WarningType, string> = {
  MIN_NOT_MET: 'מינימום משמרות לא הושלם',
  UNFILLED: 'תקן לא מאויש',
  UNDERSTAFFED: 'חוסר תקן',
  CONFLICT: 'התנגשות',
  FAIRNESS: 'הוגנות',
};

const SEVERITY_STYLES: Record<WarningSeverity, { section: string; badge: string; icon: string; row: string }> = {
  ERROR: {
    section: 'border-red-300 bg-red-50/70',
    badge: 'bg-red-100 text-red-800 border-red-200',
    icon: 'text-red-700',
    row: 'border-red-100',
  },
  WARNING: {
    section: 'border-amber-300 bg-amber-50/70',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: 'text-amber-700',
    row: 'border-amber-100',
  },
  INFO: {
    section: 'border-blue-200 bg-blue-50/70',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: 'text-blue-700',
    row: 'border-blue-100',
  },
};

function SeverityIcon({ severity }: { severity: WarningSeverity }) {
  const className = cn('h-4 w-4 shrink-0', SEVERITY_STYLES[severity].icon);
  if (severity === 'ERROR') return <AlertTriangle className={className} />;
  if (severity === 'WARNING') return <AlertTriangle className={className} />;
  return <Info className={className} />;
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

function buildWarningLabel(warning: ScheduleWarningSummary): string {
  const context = [
    warning.date ? formatDate(warning.date) : null,
    warning.shiftType ? SHIFT_LABELS[warning.shiftType] : null,
    warning.employeeName,
    warning.positionName,
  ].filter(Boolean);
  const typeLabel = WARNING_TYPE_LABELS[warning.type];

  if (context.length > 0) return `${context.join(' · ')} — ${typeLabel}`;
  return typeLabel || warning.message;
}

function createInitialExpanded(warnings: ScheduleWarningSummary[]): Record<WarningSeverity, boolean> {
  return {
    ERROR: warnings.some((warning) => warning.severity === 'ERROR'),
    WARNING: warnings.some((warning) => warning.severity === 'WARNING'),
    INFO: warnings.some((warning) => warning.severity === 'INFO'),
  };
}

export function WarningsPanel({ warnings }: Props) {
  const grouped = useMemo(
    () =>
      new Map<WarningSeverity, ScheduleWarningSummary[]>(
        SEVERITIES.map((severity) => [severity, warnings.filter((warning) => warning.severity === severity)]),
      ),
    [warnings],
  );
  const [expanded, setExpanded] = useState<Record<WarningSeverity, boolean>>(() => createInitialExpanded(warnings));
  const [showAll, setShowAll] = useState<Record<WarningSeverity, boolean>>({
    ERROR: false,
    WARNING: false,
    INFO: false,
  });

  if (warnings.length === 0) {
    return (
      <Card className="rounded-md shadow-none border-green-200 bg-green-50" dir="rtl">
        <CardContent className="flex items-center gap-2 p-4 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          אין אזהרות בשיבוץ הנוכחי
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-md shadow-none" dir="rtl">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-base">אזהרות שיבוץ</CardTitle>
        <div className="flex flex-wrap gap-2 pt-1.5">
          {SEVERITIES.map((severity) => (
            <span
              key={severity}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                SEVERITY_STYLES[severity].badge,
              )}
            >
              {SEVERITY_LABELS[severity]}
              <span>{grouped.get(severity)?.length ?? 0}</span>
            </span>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-2 p-3 pt-1">
        {SEVERITIES.map((severity) => {
          const rows = grouped.get(severity) ?? [];
          if (rows.length === 0) return null;
          const isExpanded = expanded[severity];
          const isShowingAll = showAll[severity];
          const visibleRows = isShowingAll ? rows : rows.slice(0, DEFAULT_VISIBLE_COUNT);

          return (
            <section key={severity} className={cn('rounded-md border', SEVERITY_STYLES[severity].section)}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-right text-sm font-semibold"
                onClick={() => setExpanded((current) => ({ ...current, [severity]: !current[severity] }))}
                aria-expanded={isExpanded}
              >
                <span className="flex items-center gap-2">
                  <SeverityIcon severity={severity} />
                  {SEVERITY_LABELS[severity]}
                  <span
                    className={cn(
                      'inline-flex min-w-6 justify-center rounded-full border px-2 py-0.5 text-xs',
                      SEVERITY_STYLES[severity].badge,
                    )}
                  >
                    {rows.length}
                  </span>
                </span>
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>

              {isExpanded && (
                <div className="border-t bg-background/50">
                  <ul className="divide-y">
                    {visibleRows.map((warning) => (
                      <li
                        key={warning.id}
                        className={cn('border-r-2 px-3 py-1.5 text-sm leading-6', SEVERITY_STYLES[severity].row)}
                      >
                        {buildWarningLabel(warning)}
                      </li>
                    ))}
                  </ul>

                  {rows.length > DEFAULT_VISIBLE_COUNT && (
                    <div className="px-3 py-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => setShowAll((current) => ({ ...current, [severity]: !current[severity] }))}
                      >
                        {isShowingAll ? 'הצג פחות' : 'הצג עוד'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
