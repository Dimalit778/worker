import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <Card className="w-full max-w-sm" dir="rtl">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">שכחתי סיסמה</CardTitle>
        <p className="text-sm text-muted-foreground">נשלח אליך קישור לאיפוס הסיסמה</p>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
