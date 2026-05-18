import type { WarningSeverity } from '@/generated/prisma/client';
import type { ScheduleWarningSummary } from './types';

export type EmployeeWarningGroup = {
  employeeName: string;
  positionName: string | null;
  warnings: ScheduleWarningSummary[];
  worstSeverity: WarningSeverity;
};

const SEVERITY_RANK: Record<WarningSeverity, number> = { ERROR: 0, WARNING: 1, INFO: 2 };

function worstOf(warnings: ScheduleWarningSummary[]): WarningSeverity {
  return warnings.reduce<WarningSeverity>(
    (best, w) => (SEVERITY_RANK[w.severity] < SEVERITY_RANK[best] ? w.severity : best),
    'INFO',
  );
}

export function groupWarningsByEmployee(warnings: ScheduleWarningSummary[]): EmployeeWarningGroup[] {
  const map = new Map<string, EmployeeWarningGroup>();

  for (const w of warnings) {
    if (!w.employeeName) continue;
    const existing = map.get(w.employeeName);
    if (existing) {
      existing.warnings.push(w);
    } else {
      map.set(w.employeeName, {
        employeeName: w.employeeName,
        positionName: w.positionName,
        warnings: [w],
        worstSeverity: w.severity,
      });
    }
  }

  // Recompute worstSeverity after all warnings are grouped
  const groups = Array.from(map.values()).map(g => ({ ...g, worstSeverity: worstOf(g.warnings) }));
  return groups.sort((a, b) => SEVERITY_RANK[a.worstSeverity] - SEVERITY_RANK[b.worstSeverity]);
}
