import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { StaffPositionCount } from '../queries';
import { CHART_COLORS, StaffPositionChart } from './staff-position-chart';

type StaffSummaryProps = {
  byPosition: StaffPositionCount[];
  totalActive: number;
};

export function StaffSummary({ byPosition, totalActive }: StaffSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">עובדים</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 items-center gap-4">
        <div className="flex justify-center">
          <StaffPositionChart byPosition={byPosition} totalActive={totalActive} />
        </div>

        <ul className="w-full space-y-3">
          {byPosition.map((item, index) => (
            <li key={item.name} className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: item.color ?? CHART_COLORS[index % CHART_COLORS.length] }}
                  aria-hidden
                />
                <span className="truncate text-sm text-muted-foreground">{item.name}</span>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{item.count}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
