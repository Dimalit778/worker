import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getDraftScheduleData } from '@/features/shift-assignments/queries';
import { Schedule } from '@/features/shift-assignments/components/schedule';
import { DraftActions } from '@/features/schedules/components/draft-actions';

export default async function DraftPage() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId ?? '';

  const data = await getDraftScheduleData(courtId);

  if (!data.found) {
    return (
      <div className="space-y-4" dir="rtl">
        <h1 className="text-2xl font-bold">שיבוץ בהכנה</h1>
        <p className="text-sm text-muted-foreground">
          אין תקופה נעולה כרגע. נעל תקופה בדף &quot;תקופות&quot; כדי להתחיל בעריכת השיבוץ.
        </p>
      </div>
    );
  }

  const isReadonly = data.scheduleStatus === 'PUBLISHED';

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">שיבוץ בהכנה</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.periodName} &nbsp;·&nbsp; {data.startDate} – {data.endDate}
          </p>
        </div>

        <DraftActions scheduleId={data.scheduleId} scheduleStatus={data.scheduleStatus} />
      </div>

      {isReadonly && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">
          השיבוץ פורסם ומוצג לכלל העובדים. לעריכה נוספת יש לפנות להגדרות.
        </div>
      )}

      <Schedule
        periodId={data.periodId}
        periodName={data.periodName}
        startDate={data.startDate}
        endDate={data.endDate}
        scheduleId={data.scheduleId}
        scheduleStatus={data.scheduleStatus}
        assignments={data.assignments}
        employees={data.employees}
        capacity={data.capacity}
        courtId={data.courtId}
        readonly={isReadonly}
      />
    </div>
  );
}
