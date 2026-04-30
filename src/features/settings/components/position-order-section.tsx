'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createPosition, movePositionDown, movePositionUp } from '../actions';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

type PositionRow = {
  id: string;
  name: string;
  code: number;
};

type Props = {
  positions: PositionRow[];
  className?: string;
};

export function PositionOrderSection({ positions, className }: Props) {
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
    <div className={cn('space-y-5', className)} dir="rtl">
      <div className="overflow-x-auto rounded-xl border border-border/80 bg-muted/20 shadow-sm">
        <table className="w-full min-w-[min(100%,320px)] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-right text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">שם התפקיד</th>
              <th className="w-16 px-2 py-2.5 text-center font-medium">#</th>
              <th className="w-22 px-2 py-2.5 text-center font-medium">סידור</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  עדיין אין תפקידים. הוסיף שם להלן או הוסף תפקיד עם קיבולת משמרת.
                </td>
              </tr>
            ) : (
              positions.map((p, i) => (
                <tr key={p.id} className="border-b border-border/80 transition-colors last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-medium">{p.name}</td>
                  <td className="px-2 py-2.5 text-center text-xs tabular-nums text-muted-foreground">{p.code}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 sm:h-8 sm:w-8"
                        disabled={isPending || i === 0}
                        aria-label="הזז מעלה ברשימה"
                        onClick={() => void handleMove(p.id, 'up')}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 sm:h-8 sm:w-8"
                        disabled={isPending || i === positions.length - 1}
                        aria-label="הזז מטה ברשימה"
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

      <div className="rounded-xl border border-dashed border-border/90 bg-background/50 p-4 sm:p-5">
        <p className="mb-3 text-sm font-medium text-foreground">הוספת תפקיד (שם בלבד)</p>
        <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="new-position-name-inline" className="text-muted-foreground">
              שם
            </Label>
            <Input
              id="new-position-name-inline"
              name="newPositionName"
              required
              autoComplete="off"
              placeholder="לדוגמה: רכז משמרת"
              disabled={isPending}
              className="h-10"
            />
          </div>
          <Button type="submit" className="h-10 shrink-0 px-5" disabled={isPending}>
            {isPending ? 'יוצר...' : 'צור תפקיד'}
          </Button>
        </form>
        {errorMsg ? <p className="mt-3 text-sm text-destructive">{errorMsg}</p> : null}
      </div>
    </div>
  );
}
