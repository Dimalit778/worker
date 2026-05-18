'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHIFT_LABELS } from '@/features/schedules/constants';
import type { EmployeeWarningGroup } from '@/features/schedules/warnings-utils';
import type { WarningSeverity, WarningType } from '@/generated/prisma/client';

type Props = {
  groups: EmployeeWarningGroup[];
};

const WARNING_TYPE_LABELS: Record<WarningType, string> = {
  MIN_NOT_MET: 'מינימום משמרות לא הושלם',
  UNFILLED: 'תקן לא מאויש',
  UNDERSTAFFED: 'חוסר תקן',
  CONFLICT: 'התנגשות',
  FAIRNESS: 'הוגנות',
};

const SEVERITY_LABELS: Record<WarningSeverity, string> = {
  ERROR: 'שגיאה',
  WARNING: 'אזהרה',
  INFO: 'מידע',
};

const GROUP_STYLES: Record<WarningSeverity, { wrap: string; header: string; tag: string; bullet: string }> = {
  ERROR: {
    wrap: 'border-red-200 bg-red-50/60',
    header: 'text-red-700',
    tag: 'bg-red-100 text-red-700 border-red-200',
    bullet: 'text-red-300',
  },
  WARNING: {
    wrap: 'border-amber-200 bg-amber-50/60',
    header: 'text-amber-700',
    tag: 'bg-amber-100 text-amber-700 border-amber-200',
    bullet: 'text-amber-300',
  },
  INFO: {
    wrap: 'border-blue-200 bg-blue-50/60',
    header: 'text-blue-700',
    tag: 'bg-blue-100 text-blue-700 border-blue-200',
    bullet: 'text-blue-300',
  },
};

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}`;
}

function SeverityIcon({ severity, className }: { severity: WarningSeverity; className?: string }) {
  if (severity === 'INFO') return <Info className={cn('h-3.5 w-3.5', className)} />;
  return <AlertTriangle className={cn('h-3.5 w-3.5', className)} />;
}

export function EmployeeWarningsPanel({ groups }: Props) {
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" dir="rtl">
      {groups.map((group) => {
        const s = GROUP_STYLES[group.worstSeverity];
        const count = group.warnings.length;
        const label = count === 1 ? `1 ${SEVERITY_LABELS[group.worstSeverity]}` : `${count} בעיות`;

        return (
          <div
            key={group.employeeName}
            className={cn('rounded-xl border overflow-hidden', s.wrap)}
          >
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
                const context = [
                  w.date ? formatDate(w.date) : null,
                  w.shiftType ? SHIFT_LABELS[w.shiftType] : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <p key={w.id} className="text-xs text-foreground/75 flex gap-1.5 items-baseline">
                    <span className={cn('text-base leading-none', s.bullet)} aria-hidden>·</span>
                    <span>
                      {WARNING_TYPE_LABELS[w.type]}
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
