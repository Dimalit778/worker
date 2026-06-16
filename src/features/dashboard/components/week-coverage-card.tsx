import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/features/periods/utils';
import type { WeekCoverage } from '../types';

type WeekCoverageCardProps = {
  coverage: WeekCoverage;
};

export function WeekCoverageCard({ coverage }: WeekCoverageCardProps) {
  const total = coverage.filledSlots + coverage.unfilledSlots;
  const pct = total > 0 ? Math.round((coverage.filledSlots / total) * 100) : coverage.filledSlots > 0 ? 100 : 0;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">כיסוי השבוע</h2>
        <p className="text-sm text-muted-foreground">
          {formatDate(coverage.weekStart)} – {formatDate(coverage.weekEnd)}
        </p>
      </div>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">מצב השיבוץ הפעיל</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!coverage.hasActiveSchedule ? (
            <p className="text-sm text-muted-foreground">אין שיבוץ פעיל — לא ניתן להציג כיסוי שבועי.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">משמרות מאוישות</p>
                  <p className="text-2xl font-bold tabular-nums">{coverage.filledSlots}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">חוסרים / אזהרות</p>
                  <p className="text-2xl font-bold tabular-nums text-amber-600">{coverage.unfilledSlots}</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs text-muted-foreground">כיסוי משוער</p>
                  <p className="text-2xl font-bold tabular-nums">{pct}%</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
