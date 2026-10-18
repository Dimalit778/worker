'use client';
import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { EmployeeWarningsPanel } from '@/features/schedules/warnings/components/warnings-panel';
import { groupWarningsByEmployee } from '@/features/schedules/warnings/utils';
import type { ScheduleWarningSummary } from '@/features/schedules/types';

type ActivePanel = 'errors' | 'submissions' | null;

type MissingEmployee = { id: string; displayName: string; positionName: string | null };

type Props = {
  warnings: ScheduleWarningSummary[];
  submittedCount: number;
  eligibleCount: number;
  missingEmployees: MissingEmployee[];
};

export function ScheduleStats({ warnings, submittedCount, eligibleCount, missingEmployees }: Props) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const errorWarnings = warnings.filter((w) => w.severity === 'ERROR');
  const errorCount = errorWarnings.length;

  function toggle(panel: ActivePanel) {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }

  const activeGroups = activePanel === 'errors' ? groupWarningsByEmployee(errorWarnings) : [];

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="הגשות"
          value={
            <>
              <span className="text-2xl font-bold tracking-tight">{submittedCount}</span>
              <span className="text-sm text-muted-foreground"> / {eligibleCount}</span>
            </>
          }
          open={activePanel === 'submissions'}
          disabled={missingEmployees.length === 0}
          onClick={() => toggle('submissions')}
        />
        <StatTile
          label="בעיות"
          value={<span className="text-2xl font-bold tracking-tight">{errorCount}</span>}
          open={activePanel === 'errors'}
          disabled={errorCount === 0}
          tone={errorCount > 0 ? 'danger' : 'neutral'}
          onClick={() => toggle('errors')}
        />
      </div>

      {/* Collapsible panel */}
      {activePanel === 'submissions' && (
        <Card className="rounded-xl shadow-none border-border/60 animate-in fade-in slide-in-from-top-1 duration-150">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              עובדים שלא הגישו זמינות ({missingEmployees.length})
            </p>
            <div className="flex flex-col gap-1">
              {missingEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{emp.displayName}</span>
                  {emp.positionName && <span className="text-xs text-muted-foreground">{emp.positionName}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activePanel === 'errors' && activeGroups.length > 0 && (
        <Card className="rounded-xl shadow-none border-border/60 animate-in fade-in slide-in-from-top-1 duration-150">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">בעיות לפי עובד</p>
            <EmployeeWarningsPanel groups={activeGroups} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  open,
  disabled,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  value: ReactNode;
  open: boolean;
  disabled: boolean;
  tone?: 'neutral' | 'danger';
  onClick: () => void;
}) {
  const danger = tone === 'danger';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-expanded={!disabled && open}
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-end transition-all',
        disabled ? 'cursor-default border-border/60 bg-muted/30' : 'cursor-pointer hover:-translate-y-px hover:shadow-md active:translate-y-0',
        !disabled && danger && (open ? 'border-red-400 bg-red-950 ring-2 ring-red-400' : 'border-red-200 bg-red-950/60'),
        !disabled && !danger && (open ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'border-border/60 bg-muted/30'),
      )}
    >
      <span className="min-w-0">
        <span className={cn('block text-xs font-medium', danger ? 'text-red-200' : 'text-muted-foreground')}>{label}</span>
        <span className={cn('mt-1 block tabular-nums', danger ? 'text-red-200' : 'text-foreground')}>{value}</span>
      </span>
      <ChevronDown
        className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180', danger && 'text-red-500', disabled && 'opacity-40')}
        aria-hidden
      />
    </button>
  );
}
