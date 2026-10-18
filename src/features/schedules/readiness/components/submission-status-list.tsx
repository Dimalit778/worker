'use client';

import { Badge } from '@/components/ui/badge';
import type { SubmissionReadiness } from '../queries';
import { SUBMISSION_STATUS_LABELS, type SubmissionStatus } from '../utils';

const STATUS_VARIANT: Record<SubmissionStatus, 'destructive' | 'secondary' | 'outline'> = {
  NOT_SUBMITTED: 'destructive',
  DRAFT: 'secondary',
  UNSUBMITTED_CHANGES: 'secondary',
  SUBMITTED: 'outline',
};

/** "הגישו X מתוך Y" + everyone whose availability still needs attention. */
export function SubmissionStatusList({ readiness }: { readiness: SubmissionReadiness }) {
  const submitted = readiness.counts.SUBMITTED + readiness.counts.UNSUBMITTED_CHANGES;
  const pending = readiness.employees.filter((e) => e.status !== 'SUBMITTED');

  return (
    <div className="space-y-3 text-right" dir="rtl">
      <p className="text-sm font-medium">
        הגישו {submitted} מתוך {readiness.total}
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {(['NOT_SUBMITTED', 'DRAFT', 'UNSUBMITTED_CHANGES'] as const).map((status) => (
          <span key={status}>
            {SUBMISSION_STATUS_LABELS[status]}: <span className="font-semibold text-foreground tabular-nums">{readiness.counts[status]}</span>
          </span>
        ))}
      </div>
      {pending.length > 0 ? (
        <div className="flex flex-col gap-1">
          {pending.map((emp) => (
            <div key={emp.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{emp.displayName}</span>
                <span className="ms-2 text-xs text-muted-foreground">{emp.roleName}</span>
              </span>
              <Badge variant={STATUS_VARIANT[emp.status]}>{SUBMISSION_STATUS_LABELS[emp.status]}</Badge>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-green-700">כל העובדים הגישו זמינות.</p>
      )}
    </div>
  );
}
