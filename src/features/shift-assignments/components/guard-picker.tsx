'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EmployeeSummary } from '../../court-settings/types';

type Props = {
  guards: EmployeeSummary[];
  currentUserId: string | null;
  anchorRect: DOMRect;
  onSelect: (guardId: string) => void;
  onRemove: () => void;
  onClose: () => void;
};

export function GuardPicker({ guards, currentUserId, anchorRect, onSelect, onRemove, onClose }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim() ? guards.filter((g) => g.name.includes(query.trim())) : guards;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const panel = (
    <div
      ref={panelRef}
      className="fixed z-9999 bg-white border border-border rounded-lg shadow-lg w-full max-w-36 py-1"
      style={{ top: anchorRect.bottom + 4, left: anchorRect.left }}
      dir="rtl"
    >
      <div className="px-2 pb-1 pt-1 border-b border-border">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש..."
          className="w-full text-xs px-2 py-1 border border-border rounded-md outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <ul className="max-h-44 overflow-y-auto">
        {filtered.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">לא נמצא</li>}
        {filtered.map((g) => (
          <li
            key={g.id}
            onClick={() => onSelect(g.id)}
            className={cn(
              'px-3 py-1.5 text-xs cursor-pointer hover:bg-accent',
              g.id === currentUserId && 'font-semibold bg-accent/50',
            )}
          >
            {g.name}
          </li>
        ))}
      </ul>

      {currentUserId && (
        <div className="border-t border-border mt-1">
          <button
            onClick={onRemove}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            <X className="w-3 h-3" />
            הסר שיבוץ
          </button>
        </div>
      )}
    </div>
  );

  return createPortal(panel, document.body);
}
