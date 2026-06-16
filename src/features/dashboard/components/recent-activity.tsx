import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RecentActivityItem } from '../types';

const CHANGE_TYPE_HE: Record<RecentActivityItem['changeType'], string> = {
  CREATE: 'יצירה',
  UPDATE: 'עדכון',
  DELETE: 'מחיקה',
  PUBLISH: 'פרסום',
  MANUAL_OVERRIDE: 'שינוי ידני',
};

type RecentActivityProps = {
  items: RecentActivityItem[];
};

export function RecentActivity({ items }: RecentActivityProps) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">פעילות אחרונה</h2>
        <p className="text-sm text-muted-foreground">שינויים אחרונים בשיבוצים</p>
      </div>

      <Card size="sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">10 פעולות אחרונות</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{item.scheduleName}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString('he-IL', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {CHANGE_TYPE_HE[item.changeType]}
                  {item.message ? ` · ${item.message}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">על ידי {item.changedByName}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
