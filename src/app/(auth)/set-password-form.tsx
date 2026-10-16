'use client';

import { useState, SyntheticEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Result = { ok: true } | { error: string };

export function SetPasswordForm({
  token,
  action,
  submitLabel,
}: {
  token: string;
  action: (token: string, password: string, confirm: string) => Promise<Result>;
  submitLabel: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await action(token, password, confirm);
    setLoading(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    router.push('/login');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      <div className="space-y-2">
        <Label htmlFor="password">סיסמה חדשה</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">אימות סיסמה</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'שומר...' : submitLabel}
      </Button>
    </form>
  );
}
