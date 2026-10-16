import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { isAuthTokenValid, resetPassword } from '@/lib/auth/actions';
import { SetPasswordForm } from '../../set-password-form';

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await isAuthTokenValid('reset', token);

  return (
    <Card className="w-full max-w-sm" dir="rtl">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">איפוס סיסמה</CardTitle>
        <p className="text-sm text-muted-foreground">בחר סיסמה חדשה</p>
      </CardHeader>
      <CardContent>
        {valid ? (
          <SetPasswordForm token={token} action={resetPassword} submitLabel="אפס סיסמה" />
        ) : (
          <div className="space-y-3 text-center text-sm">
            <p className="text-destructive">הקישור אינו תקף או שפג תוקפו.</p>
            <Link href="/forgot-password" className="underline">
              בקשת קישור חדש
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
