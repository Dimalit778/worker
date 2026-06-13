import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { SystemRole } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';
import { getEmployeeAvailability } from '@/features/availability/actions';
import { ScheduleCalendar } from '@/features/availability/components/schedule-calendar';
import { availabilityEntriesToRecord } from '@/features/availability/utils';
import { requireSession } from '@/lib/db/auth-helpers';

type UserSubmissionPeriodPageProps = {
  params: Promise<{ periodId: string }>;
};

export default async function UserSubmissionPeriodPage({ params }: UserSubmissionPeriodPageProps) {
  const session = await requireSession(SystemRole.EMPLOYEE);
  const { periodId } = await params;
  const periods = await getEmployeeAvailability(session.user.employeeId);
  const period = periods.find((item) => item.id === periodId);

  if (!period) notFound();

  return (
    <div className="space-y-6" dir="rtl">
      <Button asChild variant="ghost" size="sm" className="px-0 text-muted-foreground hover:bg-transparent">
        <Link href="/employee/submissions">
          <ArrowRight className="size-4" aria-hidden />
          חזרה להגשות
        </Link>
      </Button>

      <ScheduleCalendar
        period={{
          id: period.id,
          name: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
          status: period.status,
        }}
        initialEntries={availabilityEntriesToRecord(period.entries)}
        initialSubmitted={period.isSubmitted}
        viewOnly
      />
    </div>
  );
}
