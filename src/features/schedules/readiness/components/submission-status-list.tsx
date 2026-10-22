'use client';

import type { CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SubmissionReadiness } from '../queries';
import { SUBMISSION_STATUS_LABELS, type SubmissionStatus } from '../utils';

const STATUS_VARIANT: Record<SubmissionStatus, 'destructive' | 'secondary' | 'outline'> = {
  NOT_SUBMITTED: 'destructive',
  DRAFT: 'secondary',
  UNSUBMITTED_CHANGES: 'secondary',
  SUBMITTED: 'outline',
};

/** The draft overview includes submitted employees; confirmation dialogs show pending employees. */
export function SubmissionStatusList({ readiness, showAllEmployees = false }: { readiness: SubmissionReadiness; showAllEmployees?: boolean }) {
  const submitted = readiness.counts.SUBMITTED + readiness.counts.UNSUBMITTED_CHANGES;
  const employees = showAllEmployees ? readiness.employees : readiness.employees.filter((e) => e.status !== 'SUBMITTED');

  return (
    <div className="@container space-y-3 text-right" dir="rtl">
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
      {employees.length > 0 ? (
        <div
          className={cn('grid gap-2', showAllEmployees && '@sm:grid-cols-2 @2xl:grid-cols-4 @[64rem]:grid-cols-[repeat(var(--submission-columns),minmax(0,1fr))]')}
          style={showAllEmployees ? { '--submission-columns': Math.ceil(employees.length / 2) } as CSSProperties : undefined}
        >
          {employees.map((emp) => (
            <div key={emp.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{emp.displayName}</span>
                {!showAllEmployees && <span className="ms-2 text-xs text-muted-foreground">{emp.roleName}</span>}
              </span>
              {showAllEmployees ? (
                (emp.status === 'SUBMITTED' || emp.status === 'UNSUBMITTED_CHANGES') && (
                  <Check className="size-4 shrink-0 text-green-700 dark:text-green-400" role="img" aria-label="הוגש" />
                )
              ) : (
                <Badge variant={STATUS_VARIANT[emp.status]}>
                  {emp.status === 'UNSUBMITTED_CHANGES' && <Check className="shrink-0" aria-hidden="true" />}
                  {SUBMISSION_STATUS_LABELS[emp.status]}
                </Badge>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-green-700">{showAllEmployees ? 'אין עובדים להצגה.' : 'כל העובדים הגישו זמינות.'}</p>
      )}
    </div>
  );
}
