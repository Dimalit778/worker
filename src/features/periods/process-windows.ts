import { prisma } from '@/lib/db/client';
import { dueWindowActions } from './submission-window';
import { sendSubmissionOpenedEmails, sendSubmissionReminderEmails } from './notify-submission';

type ProcessWindowsResult = {
  opened: number;
  reminded: number;
  emailErrors: Record<string, string>;
};

type Kind = 'open' | 'remind';

const FIELD = { open: 'openNotifiedAt', remind: 'reminderSentAt' } as const;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

// Opening/closing is enforced by time on Schedule timestamps; this only sends notifications once.
export async function processDueSubmissionWindows(facilityId?: string): Promise<ProcessWindowsResult> {
  const result: ProcessWindowsResult = { opened: 0, reminded: 0, emailErrors: {} };
  const now = new Date();

  const schedules = await prisma.schedule.findMany({
    where: {
      ...(facilityId ? { facilityId } : {}),
      submissionOpensAt: { lte: now },
      submissionClosesAt: { gt: now },
      OR: [{ openNotifiedAt: null }, { reminderSentAt: null }],
    },
  });

  for (const schedule of schedules) {
    const due = dueWindowActions({
      now,
      opensAt: schedule.submissionOpensAt,
      closesAt: schedule.submissionClosesAt,
      openNotifiedAt: schedule.openNotifiedAt,
      reminderSentAt: schedule.reminderSentAt,
    });

    for (const kind of ['open', 'remind'] as const) {
      if (kind === 'open' ? !due.open : !due.remind) continue;
      try {
        if (await notify(kind, schedule, now, result)) {
          if (kind === 'open') result.opened += 1;
          else result.reminded += 1;
        }
      } catch (error) {
        result.emailErrors[schedule.id] = error instanceof Error ? error.message : 'שליחת האימייל נכשלה';
        await release(kind, schedule.id);
      }
    }
  }

  return result;
}

async function release(kind: Kind, scheduleId: string) {
  try {
    await prisma.schedule.updateMany({ where: { id: scheduleId }, data: { [FIELD[kind]]: null } });
  } catch (error) {
    console.error('processDueSubmissionWindows release', error);
  }
}

// Returns true when this run claimed the schedule and sent successfully.
async function notify(
  kind: Kind,
  schedule: {
    id: string;
    facilityId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    submissionClosesAt: Date;
  },
  now: Date,
  result: ProcessWindowsResult,
): Promise<boolean> {
  const field = FIELD[kind];
  const claim = await prisma.schedule.updateMany({
    where: { id: schedule.id, [field]: null },
    data: { [field]: now },
  });
  if (claim.count !== 1) return false;

  try {
    const users = await prisma.user.findMany({
      where: {
        facilityId: schedule.facilityId,
        isActive: true,
        systemRole: 'USER',
        ...(kind === 'remind'
          ? { submissions: { none: { scheduleId: schedule.id, submittedAt: { not: null } } } }
          : {}),
      },
      select: { email: true },
    });
    const send = kind === 'open' ? sendSubmissionOpenedEmails : sendSubmissionReminderEmails;
    const sent = await send({
      recipients: users.map((user) => user.email),
      periodName: schedule.name,
      startDate: isoDate(schedule.startDate),
      endDate: isoDate(schedule.endDate),
      deadline: schedule.submissionClosesAt,
    });
    if (!sent.ok) {
      result.emailErrors[schedule.id] = sent.error;
      await release(kind, schedule.id);
      return false;
    }
    return true;
  } catch (error) {
    await release(kind, schedule.id);
    throw error;
  }
}

export async function syncSubmissionWindows(facilityId: string | null | undefined) {
  if (!facilityId) return;
  try {
    await processDueSubmissionWindows(facilityId);
  } catch (error) {
    console.error('syncSubmissionWindows', error);
  }
}
