'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePositionColor } from '../actions';
import { invalidateSettingsQueries } from '../hooks';
import { cn } from '@/lib/utils';

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

    function handleScroll() {
      setOpen(false);
    }

    updatePosition();
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', handleScroll, true);
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
              className="fixed z-50 flex flex-wrap gap-1.5 overflow-visible rounded-lg border border-border bg-card p-2 shadow-lg"
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
  '#b91c1c', // אדום כהה
  '#c2410c', // כתום כהה
  '#a16207', // צהוב כהה
  '#15803d', // ירוק כהה
  '#0f766e', // טורקיז כהה
  '#1d4ed8', // כחול כהה
  '#6d28d9', // סגול כהה
  '#be185d', // ורוד כהה
  '#4b5563', // אפור כהה
  '#4d7c0f', // ליים כהה
] as const;

type PositionRow = {
  id: string;
  name: string;
  color: string | null;
};

type Props = {
  facilityId: string;
  positions: PositionRow[];
  className?: string;
};

export function PositionOrderSection({ facilityId, positions, className }: Props) {
  const queryClient = useQueryClient();

  const invalidate = () => invalidateSettingsQueries(queryClient, facilityId);

  const colorMutation = useMutation({
    mutationFn: ({ positionId, color }: { positionId: string; color: string | null }) =>
      updatePositionColor(positionId, color),
    onSuccess: invalidate,
  });

  const isPending = colorMutation.isPending;

  function handleColorChange(positionId: string, color: string) {
    colorMutation.mutate({ positionId, color: color || null });
  }

  return (
    <div className={cn('space-y-5', className)} dir="rtl">
      <div className="overflow-x-auto rounded-xl border border-border/80 bg-muted/20 shadow-sm">
        <table className="w-full min-w-[min(100%,320px)] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-right text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">שם התפקיד</th>
              <th className="w-16 px-2 py-2.5 text-center font-medium">צבע</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.id} className="border-b border-border/80 transition-colors last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2.5 font-medium">{p.name}</td>
                <td className="px-2 py-2.5 text-center">
                  <ColorPicker color={p.color} disabled={isPending} onChange={(c) => handleColorChange(p.id, c)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
