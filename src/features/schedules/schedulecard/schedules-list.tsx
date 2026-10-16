import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/features/periods/utils';
import type { getFacilitySchedules } from './queries';

type ScheduleRow = Awaited<ReturnType<typeof getFacilitySchedules>>[number];

const STATUS_HE: Record<ScheduleRow['status'], string> = {
  DRAFT: 'טיוטה',
  PUBLISHED: 'פורסם',
  ARCHIVED: 'בארכיון',
};

export function SchedulesList({ schedules }: { schedules: ScheduleRow[] }) {
  if (schedules.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <CalendarDays className="size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">אין שיבוצים עדיין</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-border/60">
          {schedules.map((schedule) => (
            <li key={schedule.id}>
              <Link
                href={`/manager/schedules/${schedule.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-muted/30"
              >
                <p className="font-semibold">{schedule.name}</p>
                <Badge variant="secondary">{STATUS_HE[schedule.status]}</Badge>
                <p className="text-sm text-muted-foreground">
                  {formatDate(schedule.startDate)} – {formatDate(schedule.endDate)}
                </p>
                {schedule.publishedAt && (
                  <p className="text-sm text-muted-foreground sm:ms-auto">
                    פורסם ב-{formatDate(schedule.publishedAt)}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
