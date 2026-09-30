'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ScheduleCalendar } from '@/features/availability/components/schedule-calendar';
import { useAvailabilityCurrent } from '@/features/availability/hooks';

export function EmployeeAvailabilityClient() {
  const { data, isLoading, isError } = useAvailabilityCurrent();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground" dir="rtl">טוען זמינות...</p>;
  }

  if (isError || !data) {
    return <p className="text-sm text-destructive" dir="rtl">לא ניתן לטעון נתוני זמינות.</p>;
  }

  if (!data.period) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">Availability</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm text-center">אין תקופת שיבוץ פתוחה להגשות כרגע.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ScheduleCalendar
      key={data.period.id}
      period={data.period}
      initialEntries={data.entries}
      initialSubmitted={data.isSubmitted}
      initialNote={data.note}
    />
  );
}
