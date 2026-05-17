import { getToken } from 'next-auth/jwt';
import type { NextApiRequest } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LoginForm } from './LoginForm';

export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = await getToken({
    req: {
      cookies: Object.fromEntries(cookieStore.getAll().map((cookie) => [cookie.name, cookie.value])),
      headers: await headers(),
    } as unknown as NextApiRequest,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token?.systemRole) redirect('/');

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
