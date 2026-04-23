import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/auth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.systemRole) redirect('/');

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">שמירה בתי משפט</CardTitle>
        <p className="text-sm text-muted-foreground">כניסה למערכת</p>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
