import { getToken } from 'next-auth/jwt';
import type { NextApiRequest } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { LoginForm } from './LoginForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ passwordSet?: string }> }) {
  const { passwordSet } = await searchParams;
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
    <Card className="auth-login-card w-full max-w-sm">
      <CardContent>
        {passwordSet && <p className="mb-4 text-sm text-center">הסיסמה נשמרה. אפשר להתחבר עם הסיסמה החדשה.</p>}
        <LoginForm />
      </CardContent>
    </Card>
  );
}
