import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { acceptInvite, isAuthTokenValid } from '@/lib/auth/actions';
import { SetPasswordForm } from '../../set-password-form';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await isAuthTokenValid('invite', token);

  return (
    <Card className="w-full max-w-sm" dir="rtl">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">הגדרת סיסמה</CardTitle>
        <p className="text-sm text-muted-foreground">ברוך הבא! יש להגדיר סיסמה אישית לכניסה למערכת</p>
      </CardHeader>
      <CardContent>
        {valid ? (
          <SetPasswordForm token={token} action={acceptInvite} submitLabel="שמור סיסמה" />
        ) : (
          <div className="space-y-3 text-center text-sm">
            <p className="text-destructive">הקישור אינו תקף או שפג תוקפו. יש לבקש מהמנהל לשלוח הזמנה חדשה.</p>
            <Link href="/login" className="underline">
              חזרה לכניסה
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
