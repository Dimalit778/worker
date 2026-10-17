function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function buildAuthLink(path: string): string {
  const appUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? '';
  return `${appUrl}${path}`;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false, error: 'שליחת האימייל לא הוגדרה' };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!response.ok) return { ok: false, error: 'שליחת האימייל נכשלה' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'שליחת האימייל נכשלה' };
  }
}

function body(text: string, link: string, label: string): string {
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.5">
      <p>${escapeHtml(text)}</p>
      <p><a href="${escapeHtml(link)}">${escapeHtml(label)}</a></p>
    </div>
  `.trim();
}

export function sendInviteEmail(to: string, link: string) {
  return sendEmail(
    to,
    'הזמנה למערכת שמירה בתי משפט',
    body('הוזמנת למערכת. יש להגדיר סיסמה אישית (הקישור תקף ל-72 שעות).', link, 'הגדרת סיסמה'),
  );
}

export function sendResetEmail(to: string, link: string) {
  return sendEmail(
    to,
    'איפוס סיסמה',
    body(
      'התקבלה בקשה לאיפוס סיסמה (הקישור תקף לשעה אחת). אם לא ביקשת, ניתן להתעלם מהודעה זו.',
      link,
      'איפוס סיסמה',
    ),
  );
}
