'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createPosition, movePositionDown, movePositionUp } from '../actions';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

type PositionRow = {
  id: string;
  name: string;
  displayOrder: number;
};

export function PositionOrderSection({ positions }: { positions: PositionRow[] }) {
  const router = useRouter();
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get('newPositionName') as string) ?? '';

    setErrorMsg('');
    startTransition(async () => {
      const res = await createPosition(name);
      if ('error' in res) {
        setErrorMsg(res.error ?? '');
        return;
      }
      (e.currentTarget as HTMLFormElement).reset();
      router.refresh();
    });
  }

  function handleMove(positionId: string, direction: 'up' | 'down') {
    setErrorMsg('');
    startTransition(async () => {
      const res = direction === 'up' ? await movePositionUp(positionId) : await movePositionDown(positionId);
      if ('error' in res) {
        setErrorMsg(res.error ?? '');
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-3" dir="rtl">
      <h3 className="text-base font-semibold">סדר תפקידים</h3>
      <p className="text-sm text-muted-foreground">הזזת תפקידים בטבלה משפיעה על איך הם מופיעים בקיבולת וברשימות.</p>

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-right">
              <th className="px-3 py-2 font-medium">שם</th>
              <th className="w-20 px-2 py-2 text-center font-medium">סדר</th>
              <th className="w-24 px-2 py-2 text-center font-medium">הזזה</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                  אין תפקידים עדיין
                </td>
              </tr>
            ) : (
              positions.map((p, i) => (
                <tr key={p.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-2 py-2 text-center tabular-nums text-muted-foreground">{p.displayOrder}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={isPending || i === 0}
                        aria-label="העלה"
                        onClick={() => void handleMove(p.id, 'up')}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={isPending || i === positions.length - 1}
                        aria-label="הורד"
                        onClick={() => void handleMove(p.id, 'down')}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="new-position-name-inline">תפקיד חדש (שם בלבד)</Label>
          <Input
            id="new-position-name-inline"
            name="newPositionName"
            required
            autoComplete="off"
            placeholder="שם התפקיד"
            disabled={isPending}
          />
        </div>
        <Button type="submit" className="shrink-0" disabled={isPending}>
          {isPending ? 'שומר...' : 'צור תפקיד'}
        </Button>
      </form>

      {errorMsg ? <p className="text-sm text-destructive">{errorMsg}</p> : null}
    </section>
  );
}
