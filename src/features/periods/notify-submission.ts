import { formatDate } from './utils';
import { formatJerusalemDateTime } from './submission-window';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

type EmailInput = {
  recipients: string[];
  periodName: string;
  startDate: string;
  endDate: string;
  deadline: Date;
};

type EmailResult = { ok: true; sent: number } | { ok: false; error: string };

export async function sendSubmissionOpenedEmails(input: EmailInput): Promise<EmailResult> {
  return sendEmails(input, {
    subject: `נפתחה הגשת זמינות — ${input.periodName}`,
    intro: 'נפתחה הגשת זמינות לתקופה',
    deadlineLine: 'יש להגיש עד',
  });
}

export async function sendSubmissionReminderEmails(input: EmailInput): Promise<EmailResult> {
  return sendEmails(input, {
    subject: `תזכורת: הגשת זמינות — ${input.periodName}`,
    intro: 'טרם הגשת זמינות לתקופה',
    deadlineLine: 'ההגשה נסגרת ב',
  });
}

export async function sendSubmissionExtendedEmails(input: EmailInput & { reason: string }): Promise<EmailResult> {
  return sendEmails(input, {
    subject: `הוארך מועד הגשת הזמינות — ${input.periodName}`,
    intro: 'הוארך מועד הגשת הזמינות לתקופה',
    deadlineLine: 'המועד החדש להגשה:',
    note: `סיבת ההארכה: ${input.reason}`,
  });
}

async function sendEmails(
  input: EmailInput,
  text: { subject: string; intro: string; deadlineLine: string; note?: string },
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, error: 'שליחת האימייל לא הוגדרה' };
  }
  if (input.recipients.length === 0) {
    return { ok: true, sent: 0 };
  }

  const appUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? '';
  const link = appUrl ? `${appUrl}/employee/availability` : '';
  const deadlineLabel = formatJerusalemDateTime(input.deadline);
  const range = `${formatDate(input.startDate)}–${formatDate(input.endDate)}`;
  const subject = text.subject;
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.5">
      <p>${text.intro} <strong>${escapeHtml(input.periodName)}</strong> (${escapeHtml(range)}).</p>
      <p>${text.deadlineLine} ${escapeHtml(deadlineLabel)}.</p>
      ${text.note ? `<p>${escapeHtml(text.note)}</p>` : ''}
      ${link ? `<p><a href="${escapeHtml(link)}">להגשת הזמינות</a></p>` : ''}
    </div>
  `.trim();

  let sent = 0;
  for (let index = 0; index < input.recipients.length; index += 100) {
    const chunk = input.recipients.slice(index, index + 100);
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        chunk.map((email) => ({
          from,
          to: [email],
          subject,
          html,
        })),
      ),
    });

    if (!response.ok) {
      return { ok: false, error: 'שליחת האימייל נכשלה' };
    }
    sent += chunk.length;
  }

  return { ok: true, sent };
}
