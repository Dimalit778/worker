import { prisma } from '@/lib/db/client';
import { sendSubmissionOpenedEmails } from './notify-submission';

type ProcessWindowsResult = {
  opened: number;
  locked: number;
  emailErrors: Record<string, string>;
};

async function notifyPeriodOpened(
  facilityId: string,
  period: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    submissionDeadline: Date;
  },
): Promise<string | null> {
  const claimed = await prisma.schedulePeriod.updateMany({
    where: { id: period.id, submissionNotifiedAt: null },
    data: { submissionNotifiedAt: new Date() },
  });
  if (claimed.count === 0) return null;

  const release = async () => {
    await prisma.schedulePeriod.update({
      where: { id: period.id },
      data: { submissionNotifiedAt: null },
    });
  };

  try {
    const employees = await prisma.employee.findMany({
      where: {
        facilityId,
        isActive: true,
        primaryShiftRole: { code: { not: 1 } },
        user: { isNot: null },
      },
      select: { user: { select: { email: true } } },
    });
    const recipients = employees.flatMap((employee) => (employee.user?.email ? [employee.user.email] : []));
    const result = await sendSubmissionOpenedEmails({
      recipients,
      periodName: period.name,
      startDate: period.startDate.toISOString().slice(0, 10),
      endDate: period.endDate.toISOString().slice(0, 10),
      deadline: period.submissionDeadline,
    });
    if (!result.ok) {
      await release();
      return result.error;
    }
    return null;
  } catch (error) {
    console.error('notifyPeriodOpened', error);
    await release();
    return 'שליחת האימייל נכשלה';
  }
}

export async function processDueSubmissionWindows(facilityId?: string): Promise<ProcessWindowsResult> {
  const now = new Date();
  const courtFilter = facilityId ? { facilityId } : {};
  let opened = 0;
  let locked = 0;
  const emailErrors: Record<string, string> = {};

  const due = await prisma.schedulePeriod.findMany({
    where: { ...courtFilter, submissionState: { in: ['SCHEDULED', 'OPEN'] }, submissionOpensAt: { lte: now } },
    include: { schedule: true },
  });
  for (const period of due) {
    const closed = period.submissionDeadline <= now;
    const state = closed ? 'CLOSED' : 'OPEN';
    if (period.submissionState === state) continue;
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Facility" WHERE id=${period.facilityId} FOR UPDATE`;
      const moved = await tx.schedulePeriod.updateMany({ where: { id: period.id, submissionState: period.submissionState }, data: { submissionState: state } });
      if (!moved.count) return;
      if (closed) locked += 1; else opened += 1;
    });
  }

  const pending = await prisma.roster.findMany({
    where: {
      ...courtFilter,
      archivedAt: null,
      period: { submissionState: 'OPEN', submissionDeadline: { gt: now }, submissionNotifiedAt: null },
    },
    select: {
      facilityId: true,
      period: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          submissionDeadline: true,
        },
      },
    },
  });

  for (const schedule of pending) {
    const failure = await notifyPeriodOpened(schedule.facilityId, schedule.period);
    if (failure) emailErrors[schedule.period.id] = failure;
  }

  return { opened, locked, emailErrors };
}

export async function syncSubmissionWindows(facilityId: string | null | undefined) {
  if (!facilityId) return;
  try {
    await processDueSubmissionWindows(facilityId);
  } catch (error) {
    console.error('syncSubmissionWindows', error);
  }
}
