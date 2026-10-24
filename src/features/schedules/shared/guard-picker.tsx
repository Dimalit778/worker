'use client';

import { useState, useRef, useEffect, useLayoutEffect, type CSSProperties } from 'react';
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
  anchorElement?: HTMLElement;
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
  anchorElement,
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
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });

  const selectableEmployees = employees.filter(employee => !disabledEmployeeIds?.has(employee.id));
  const filtered = query.trim()
    ? selectableEmployees.filter((employee) => employee.displayName.includes(query.trim()))
    : selectableEmployees;

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    let frame: number | undefined;
    const updatePosition = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const rect = anchorElement?.getBoundingClientRect() ?? anchorRect;
      const margin = 8, gap = 4;
      const viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
      if (anchorElement && (rect.bottom <= 0 || rect.top >= viewportHeight || rect.right <= 0 || rect.left >= viewportWidth)) {
        onClose();
        return;
      }
      const panelRect = panel.getBoundingClientRect();
      const width = panelRect.width || 176;
      const height = panel.scrollHeight || panelRect.height;
      const below = Math.max(0, viewportHeight - rect.bottom - gap - margin);
      const above = Math.max(0, (rect.top ?? rect.bottom) - gap - margin);
      const openBelow = height <= below || below >= above;
      const maxHeight = Math.min(openBelow ? below : above, viewportHeight - margin * 2);
      const top = openBelow ? rect.bottom + gap : (rect.top ?? rect.bottom) - gap - Math.min(height, maxHeight);
      setPosition({
        top: Math.max(margin, top),
        left: Math.max(margin, Math.min(rect.left, viewportWidth - width - margin)),
        maxHeight,
      });
    };
    const schedulePosition = (event?: Event) => {
      // Scrolling the employee list must not move or dismiss its own picker.
      if (event?.type === 'scroll' && event.target instanceof Node && panelRef.current?.contains(event.target)) return;
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updatePosition);
    };
    updatePosition();
    document.addEventListener('scroll', schedulePosition, true);
    window.addEventListener('resize', schedulePosition);
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => schedulePosition());
    if (panelRef.current) observer?.observe(panelRef.current);
    if (anchorElement) observer?.observe(anchorElement);
    return () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      document.removeEventListener('scroll', schedulePosition, true);
      window.removeEventListener('resize', schedulePosition);
      observer?.disconnect();
    };
  }, [anchorElement, anchorRect, onClose, filtered.length]);

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
      className="fixed z-9999 bg-card border border-border rounded-lg shadow-lg w-44 max-w-[calc(100vw-16px)] overflow-y-auto py-1"
      style={position}
      dir="rtl"
    >
      <div className="px-2 pb-1 pt-1 border-b border-border">
        <Input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש..." />
      </div>

      <ul className="md:max-h-44 md:overflow-y-auto">
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
