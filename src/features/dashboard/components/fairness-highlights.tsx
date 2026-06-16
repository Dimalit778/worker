import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FairnessHighlight } from '../types';

type FairnessHighlightsProps = {
  items: FairnessHighlight[];
};

export function FairnessHighlights({ items }: FairnessHighlightsProps) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">הוגנות — סופ״ש ומשמרות</h2>
        <p className="text-sm text-muted-foreground">עובדים עם הכי הרבה משמרות סוף שבוע בשיבוץ הפעיל</p>
      </div>

      <Card size="sm">
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.employeeName} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium">{item.employeeName}</span>
                <span className="tabular-nums text-muted-foreground">
                  {item.weekendShifts} סופ״ש · {item.totalShifts} סה״כ
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
