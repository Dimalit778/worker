'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduleEmployeeOption } from '@/features/schedules/types';
import type { CustomHours } from '@/features/schedules/shift-times';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type SwapCandidate = {
  assignmentId: string;
  employeeId: string;
  displayName: string;
};

type Props = {
  employees: ScheduleEmployeeOption[];
  currentUserId: string | null;
  disabledEmployeeIds?: Set<string>;
  anchorRect: DOMRect;
  onSelect: (employeeId: string) => void;
  onRemove: () => void;
  onClose: () => void;
  swapCandidates?: SwapCandidate[];
  onSwap?: (assignmentId: string) => void;
  /** Custom hours of the current employee; the editor shows only when onSetHours is given. */
  currentHours?: CustomHours;
  defaultHours?: CustomHours;
  onSetHours?: (hours: CustomHours | null) => void;
};

export function GuardPicker({
  employees,
  currentUserId,
  disabledEmployeeIds,
  anchorRect,
  onSelect,
  onRemove,
  onClose,
  currentHours,
  defaultHours,
  onSetHours,
}: Props) {
  const [query, setQuery] = useState('');
  const [startTime, setStartTime] = useState(currentHours?.startTime ?? defaultHours?.startTime ?? '');
  const [endTime, setEndTime] = useState(currentHours?.endTime ?? defaultHours?.endTime ?? '');
  const hoursValid = Boolean(startTime && endTime && startTime !== endTime);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectableEmployees = employees.filter(employee => !disabledEmployeeIds?.has(employee.id));
  const filtered = query.trim()
    ? selectableEmployees.filter((employee) => employee.displayName.includes(query.trim()))
    : selectableEmployees;

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
      className="fixed z-9999 bg-card border border-border rounded-lg shadow-lg w-full max-w-44 py-1"
      style={{ top: anchorRect.bottom + 4, left: anchorRect.left }}
      dir="rtl"
    >
      <div className="px-2 pb-1 pt-1 border-b border-border">
        <Input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש..." />
      </div>

      <ul className="max-h-44 overflow-y-auto">
        {filtered.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">לא נמצא</li>}
        {filtered.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onSelect(e.id)}
              className={cn(
                'w-full cursor-pointer px-3 py-1.5 text-start text-xs hover:bg-accent',
                e.id === currentUserId && 'font-semibold bg-accent/50',
              )}
            >
              <span>{e.displayName}</span>
            </button>
          </li>
        ))}
      </ul>

      {currentUserId && onSetHours && (
        <div className="border-t border-border mt-1 px-2 py-1.5 space-y-1">
          <div className="text-xs font-medium">שעות מיוחדות</div>
          <label className="flex items-center justify-between gap-1 text-xs">
            התחלה
            <Input type="time" dir="ltr" className="h-7 w-24 px-1 text-xs" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className="flex items-center justify-between gap-1 text-xs">
            סיום
            <Input type="time" dir="ltr" className="h-7 w-24 px-1 text-xs" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" disabled={!hoursValid} onClick={() => onSetHours(startTime === defaultHours?.startTime && endTime === defaultHours?.endTime ? null : { startTime, endTime })}>עדכן שעות</Button>
            {currentHours && (
              <Button type="button" size="sm" variant="outline" onClick={() => onSetHours(null)}>שעות רגילות</Button>
            )}
          </div>
        </div>
      )}

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
