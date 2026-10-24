'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHIFT_LABELS } from '@/features/schedules/constants';
import type { ScheduleWarningSummary } from '@/features/schedules/types';
import type { WarningSeverity, WarningType } from '@/features/scheduling-engine/types';
import { groupWarningsByEmployee, type EmployeeWarningGroup } from '../utils';

type EmployeeWarningsPanelProps = {
  groups: EmployeeWarningGroup[];
  compact?: boolean;
};

type WarningsPanelProps = {
  warnings: ScheduleWarningSummary[];
};

const WARNING_TYPE_LABELS: Record<WarningType, string> = {
  MIN_NOT_MET: 'מינימום משמרות לא הושלם',
  UNFILLED: 'תקן לא מאויש',
  UNDERSTAFFED: 'חוסר תקן',
  CONFLICT: 'התנגשות',
  FAIRNESS: 'הוגנות',
};

const SEVERITY_LABELS: Record<WarningSeverity, string> = {
  ERROR: 'בעיה',
  WARNING: 'אזהרה',
  INFO: 'מידע',
};

const GROUP_STYLES: Record<WarningSeverity, { wrap: string; header: string; tag: string; bullet: string }> = {
  ERROR: {
    wrap: 'border-red-200 bg-red-950/60',
    header: 'text-red-200',
    tag: 'bg-red-950 text-red-200 border-red-200',
    bullet: 'text-red-300',
  },
  WARNING: {
    wrap: 'border-amber-200 bg-amber-950/60',
    header: 'text-amber-200',
    tag: 'bg-amber-950 text-amber-200 border-amber-200',
    bullet: 'text-amber-300',
  },
  INFO: {
    wrap: 'border-blue-200 bg-blue-950/60',
    header: 'text-blue-200',
    tag: 'bg-blue-950 text-blue-200 border-blue-200',
    bullet: 'text-blue-300',
  },
};

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}`;
}

function compactWarningText(warning: ScheduleWarningSummary): string {
  if (warning.type === 'MIN_NOT_MET' && warning.shiftType) {
    return [warning.weekNumber ? `שבוע ${warning.weekNumber}` : null, `חסר ${SHIFT_LABELS[warning.shiftType]}`]
      .filter(Boolean).join(' — ');
  }
  const context = [warning.date ? formatDate(warning.date) : null, warning.shiftType ? SHIFT_LABELS[warning.shiftType] : null]
    .filter(Boolean).join(' · ');
  return [warning.message || WARNING_TYPE_LABELS[warning.type], context].filter(Boolean).join(' — ');
}

function SeverityIcon({ severity, className }: { severity: WarningSeverity; className?: string }) {
  if (severity === 'INFO') return <Info className={cn('h-3.5 w-3.5', className)} />;
  return <AlertTriangle className={cn('h-3.5 w-3.5', className)} />;
}

export function EmployeeWarningsPanel({ groups, compact = false }: EmployeeWarningsPanelProps) {
  if (groups.length === 0) return null;

  if (compact) {
    return (
      <div className="flex flex-col gap-2 md:max-h-72 md:overflow-y-auto" dir="rtl">
        {groups.map(group => (
          <div key={group.employeeName} className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-sm font-medium">
              {group.employeeName}
              {group.positionName && <span className="mr-1 text-xs font-normal text-muted-foreground">· {group.positionName}</span>}
            </p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {group.warnings.map(warning => (
                <li key={warning.id}>
                  {compactWarningText(warning)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2" dir="rtl">
      {groups.map((group) => {
        const s = GROUP_STYLES[group.worstSeverity];
        const count = group.warnings.length;
        const label = count === 1 ? `1 ${SEVERITY_LABELS[group.worstSeverity]}` : `${count} בעיות`;

        return (
          <div key={group.employeeName} className={cn('rounded-xl border overflow-hidden', s.wrap)}>
            <div className={cn('flex items-center justify-between px-4 py-2.5', s.header)}>
              <span className="font-semibold text-sm">
                {group.employeeName}
                {group.positionName && (
                  <span className="font-normal opacity-70 mr-1.5 text-xs">· {group.positionName}</span>
                )}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                  s.tag,
                )}
              >
                <SeverityIcon severity={group.worstSeverity} />
                {label}
              </span>
            </div>
            <div className="border-t border-black/5 px-4 py-2 flex flex-col gap-1">
              {group.warnings.map((w) => {
                const context = [w.date ? formatDate(w.date) : null, w.shiftType ? SHIFT_LABELS[w.shiftType] : null]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <p key={w.id} className="text-xs text-foreground/75 flex gap-1.5 items-baseline">
                    <span className={cn('text-base leading-none', s.bullet)} aria-hidden>
                      ·
                    </span>
                    <span>
                      {w.message || WARNING_TYPE_LABELS[w.type]}
                      {context && <span className="text-muted-foreground mr-1">— {context}</span>}
                    </span>
                  </p>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WarningsPanel({ warnings }: WarningsPanelProps) {
  return <EmployeeWarningsPanel groups={groupWarningsByEmployee(warnings)} />;
}
