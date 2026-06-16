import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { StaffPositionCount } from '../queries';

type StaffSummaryProps = {
  byPosition: StaffPositionCount[];
  totalActive: number;
};

export function StaffSummary({ byPosition, totalActive }: StaffSummaryProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">כוח אדם במתקן</h2>
          <p className="text-sm text-muted-foreground">עובדים פעילים לפי תפקיד</p>
        </div>
        <p className="text-sm text-muted-foreground">
          סה״כ פעילים: <span className="font-semibold text-foreground tabular-nums">{totalActive}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {byPosition.map((item) => (
          <Card key={item.name} size="sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">{item.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">{item.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
