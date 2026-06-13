'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduleEmployeeOption } from '../types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = {
  employees: ScheduleEmployeeOption[];
  currentUserId: string | null;
  disabledEmployeeIds?: Set<string>;
  anchorRect: DOMRect;
  onSelect: (employeeId: string) => void;
  onRemove: () => void;
  onClose: () => void;
};

export function GuardPicker({
  employees,
  currentUserId,
  disabledEmployeeIds,
  anchorRect,
  onSelect,
  onRemove,
  onClose,
}: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const available = disabledEmployeeIds
    ? employees.filter((e) => e.id === currentUserId || !disabledEmployeeIds.has(e.id))
    : employees;
  const filtered = query.trim() ? available.filter((e) => e.displayName.includes(query.trim())) : available;

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
        <Input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש..." />
      </div>

      <ul className="max-h-44 overflow-y-auto">
        {filtered.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">לא נמצא</li>}
        {filtered.map((e) => (
          <li
            key={e.id}
            onClick={() => onSelect(e.id)}
            className={cn(
              'px-3 py-1.5 text-xs cursor-pointer hover:bg-accent',
              e.id === currentUserId && 'font-semibold bg-accent/50',
            )}
          >
            {e.displayName}
          </li>
        ))}
      </ul>

      {currentUserId && (
        <div className="border-t border-border mt-1">
          <Button variant="destructive" onClick={onRemove}>
            <X className="w-3 h-3" />
            הסר שיבוץ
          </Button>
        </div>
      )}
    </div>
  );

  return createPortal(panel, document.body);
}
