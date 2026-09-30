'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePositionCapability, createPosition, movePositionDown, movePositionUp, updatePositionColor } from '../actions';
import { invalidateSettingsQueries } from '../hooks';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

function ColorPicker({
  color,
  disabled,
  onChange,
}: {
  color: string | null;
  disabled: boolean;
  onChange: (color: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const width = 148;
      const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
      setCoords({ top: rect.bottom + 6, left });
    }

    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    updatePosition();
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-block h-7 w-7 rounded border-2 border-border shadow-sm outline-none transition-transform hover:scale-110"
        style={{ backgroundColor: color ?? '#e5e7eb' }}
        title="בחר צבע"
      />
      {open && coords
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-50 flex flex-wrap gap-1.5 overflow-visible rounded-lg border border-border bg-white p-2 shadow-lg"
              style={{ top: coords.top, left: coords.left, width: 148 }}
            >
              {POSITION_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                  className={cn(
                    'h-6 w-6 rounded border-2 transition-transform hover:scale-110',
                    color === c ? 'border-gray-800' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              {color ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                  className="h-6 w-6 rounded border-2 border-dashed border-gray-300 text-[10px] text-gray-400 hover:border-gray-500"
                  title="הסר צבע"
                >
                  ✕
                </button>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

const POSITION_COLORS = [
  '#fca5a5', // אדום בהיר
  '#fdba74', // כתום
  '#fde047', // צהוב
  '#86efac', // ירוק בהיר
  '#6ee7b7', // טורקיז
  '#7dd3fc', // כחול בהיר
  '#c4b5fd', // סגול בהיר
  '#f9a8d4', // ורוד
  '#d1d5db', // אפור
  '#a3e635', // ליים
] as const;

type PositionRow = {
  id: string;
  name: string;
  code: number;
  color: string | null;
  requiredCapability?: 'GUARD' | 'CONTROLLER' | 'SHIFT_MANAGER';
};

type Props = {
  facilityId: string;
  positions: PositionRow[];
  className?: string;
};

export function PositionOrderSection({ facilityId, positions, className }: Props) {
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState('');

  const invalidate = () => invalidateSettingsQueries(queryClient, facilityId);

  const createMutation = useMutation({
    mutationFn: createPosition,
  });

  const colorMutation = useMutation({
    mutationFn: ({ positionId, color }: { positionId: string; color: string | null }) =>
      updatePositionColor(positionId, color),
    onSuccess: invalidate,
  });

  const capabilityMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: 'GUARD' | 'CONTROLLER' | 'SHIFT_MANAGER' }) => updatePositionCapability(id, value),
    onSuccess: res => { if ('error' in res) setErrorMsg(res.error ?? 'שמירה נכשלה'); else invalidate(); },
    onError: () => setErrorMsg('שמירת הכשירות נכשלה'),
  });
  const moveMutation = useMutation({
    mutationFn: ({ positionId, direction }: { positionId: string; direction: 'up' | 'down' }) =>
      direction === 'up' ? movePositionUp(positionId) : movePositionDown(positionId),
    onError: (error: Error) => setErrorMsg(error.message),
    onSuccess: (res) => {
      if ('error' in res) {
        setErrorMsg(res.error ?? '');
        return;
      }
      setErrorMsg('');
      invalidate();
    },
  });

  const isPending = capabilityMutation.isPending || createMutation.isPending || colorMutation.isPending || moveMutation.isPending;

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get('newPositionName') as string) ?? '';

    setErrorMsg('');
    createMutation.mutate(name, {
      onSuccess: (res) => {
        if ('error' in res) {
          setErrorMsg(res.error ?? '');
          return;
        }
        (e.currentTarget as HTMLFormElement).reset();
        invalidate();
      },
      onError: () => setErrorMsg('הוספת התפקיד נכשלה'),
    });
  }

  function handleColorChange(positionId: string, color: string) {
    colorMutation.mutate({ positionId, color: color || null });
  }

  function handleMove(positionId: string, direction: 'up' | 'down') {
    setErrorMsg('');
    moveMutation.mutate({ positionId, direction });
  }

  return (
    <div className={cn('space-y-5', className)} dir="rtl">
      <div className="overflow-x-auto rounded-xl border border-border/80 bg-muted/20 shadow-sm">
        <table className="w-full min-w-[min(100%,320px)] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-right text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">שם התפקיד</th>
              <th className="px-2 py-2.5 font-medium">כשירות נדרשת</th><th className="w-16 px-2 py-2.5 text-center font-medium">#</th>
              <th className="w-16 px-2 py-2.5 text-center font-medium">צבע</th>
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
                  <td><select aria-label={`כשירות נדרשת עבור ${p.name}`} value={p.requiredCapability ?? 'GUARD'} disabled={isPending} onChange={e => capabilityMutation.mutate({ id: p.id, value: e.target.value as 'GUARD' | 'CONTROLLER' | 'SHIFT_MANAGER' })}>
                    <option value="GUARD">מאבטח</option><option value="CONTROLLER">בקר</option><option value="SHIFT_MANAGER">אחמ״ש</option>
                  </select></td>
                  <td className="px-2 py-2.5 text-center text-xs tabular-nums text-muted-foreground">{p.code}</td>
                  <td className="px-2 py-2.5 text-center">
                    <ColorPicker color={p.color} disabled={isPending} onChange={(c) => handleColorChange(p.id, c)} />
                  </td>
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
        <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Input
              id="new-position-name-inline"
              name="newPositionName"
              required
              autoComplete="off"
              placeholder="שם התפקיד"
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
