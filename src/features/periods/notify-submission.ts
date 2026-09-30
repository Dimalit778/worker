import { formatDate } from './utils';
import { formatJerusalemDateTime } from './submission-window';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function sendSubmissionOpenedEmails(input: {
  recipients: string[];
  periodName: string;
  startDate: string;
  endDate: string;
  deadline: Date;
}): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
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
  const subject = `נפתחה הגשת זמינות — ${input.periodName}`;
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.5">
      <p>נפתחה הגשת זמינות לתקופה <strong>${escapeHtml(input.periodName)}</strong> (${escapeHtml(range)}).</p>
      <p>יש להגיש עד ${escapeHtml(deadlineLabel)}.</p>
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
