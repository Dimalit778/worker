'use client';

import { useState, SyntheticEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestPasswordReset } from '@/lib/auth/actions';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setDone(true);
    } catch {
      setError('אירעה שגיאה, נסה שוב');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-3 text-center text-sm">
        <p>אם קיים חשבון עם כתובת האימייל הזו, נשלח אליה קישור לאיפוס הסיסמה.</p>
        <Link href="/login" className="underline">
          חזרה לכניסה
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      <div className="space-y-2">
        <Label htmlFor="email">אימייל</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          required
          autoComplete="email"
          dir="ltr"
        />
      </div>
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
      </Button>
      <div className="text-center text-sm">
        <Link href="/login" className="underline">
          חזרה לכניסה
        </Link>
      </div>
    </form>
  );
}
