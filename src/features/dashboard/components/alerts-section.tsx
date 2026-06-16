import { ScheduleStats } from '@/features/schedules/draft-schedule/schedule-stats';
import type { ScheduleWarningSummary } from '@/features/schedules/types';
import type { MissingEmployee } from '../types';

type AlertsSectionProps = {
  warnings: ScheduleWarningSummary[];
  submissionSummary: {
    submittedCount: number;
    eligibleCount: number;
    missingEmployees: MissingEmployee[];
  } | null;
  embedded?: boolean;
};

export function AlertsSection({ warnings, submissionSummary, embedded = false }: AlertsSectionProps) {
  if (!submissionSummary && warnings.length === 0) return null;

  const stats = submissionSummary ? (
    <ScheduleStats
      warnings={warnings}
      submittedCount={submissionSummary.submittedCount}
      eligibleCount={submissionSummary.eligibleCount}
      missingEmployees={submissionSummary.missingEmployees}
    />
  ) : (
    <ScheduleStats warnings={warnings} submittedCount={0} eligibleCount={0} missingEmployees={[]} />
  );

  if (embedded) return stats;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">התראות ומצב הגשות</h2>
        <p className="text-sm text-muted-foreground">שגיאות, אזהרות ועובדים שלא הגישו זמינות</p>
      </div>
      {stats}
    </section>
  );
}
