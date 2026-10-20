'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { saveScheduleChanges, type SlotChange } from '../assignments/actions';
import { applyScheduleEdit } from '../hooks';
import type { AssignmentMap, AssignmentSummary, CurrentScheduleData } from '../types';
import { createAssignmentCellKey } from '../utils';
import { useVersionExpectation } from './version-context';
import type { ShiftType } from '@/generated/prisma/client';
import type { CustomHours } from '../shift-times';

export type SlotRef = { date: string; shiftType: ShiftType; positionId: string; slotIndex: number };

type PendingEdits = {
  /** Saved assignments with the unsaved changes applied; views render this. */
  assignments: AssignmentMap;
  setSlot: (slot: SlotRef, employeeId: string | null) => void;
  /** Set (or with null, clear) custom hours for this slot's employee on all of their cells that day. */
  setHours: (slot: SlotRef, hours: CustomHours | null) => void;
  /** Swap this slot's employee with the employee of another (effective) assignment. */
  swapWith: (slot: SlotRef, otherAssignmentId: string) => void;
  isDirty: (slot: SlotRef) => boolean;
};

const PendingEditsContext = createContext<PendingEdits | null>(null);

/** Null outside a provider (read-only screens). */
export function usePendingEdits() {
  return useContext(PendingEditsContext);
}

const slotId = (s: SlotRef) => `${createAssignmentCellKey(s)}#${s.slotIndex}`;
const NEW_ID_PREFIX = 'new:';

export function PendingEditsProvider({ data, children }: { data: CurrentScheduleData; children: ReactNode }) {
  const queryClient = useQueryClient();
  const expected = useVersionExpectation();
  const [changes, setChanges] = useState<Map<string, SlotChange>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignments = useMemo(() => {
    if (changes.size === 0) return data.assignments;
    const names = new Map(data.employees.map(e => [e.id, e.displayName]));
    const positions = new Map(data.capacity.map(c => [c.positionId, c.displayName]));
    const next: AssignmentMap = {};
    for (const [key, list] of Object.entries(data.assignments)) next[key as keyof AssignmentMap] = [...list];
    for (const change of changes.values()) {
      const key = createAssignmentCellKey(change);
      const list = next[key] ?? [];
      const index = list.findIndex(a => a.slotIndex === change.slotIndex);
      if (change.employeeId === null) {
        if (index >= 0) list.splice(index, 1);
      } else {
        const employeeName = names.get(change.employeeId) ?? '';
        const current = index >= 0 ? list[index] : undefined;
        const customHours = change.hours !== undefined ? change.hours ?? undefined
          : current?.employeeId === change.employeeId ? current.customHours : undefined;
        if (current) list[index] = { ...current, employeeId: change.employeeId, employeeDisplayName: employeeName, customHours };
        else list.push({
          id: `${NEW_ID_PREFIX}${slotId(change)}`, employeeId: change.employeeId, employeeDisplayName: employeeName,
          positionId: change.positionId, positionName: positions.get(change.positionId) ?? '',
          shiftType: change.shiftType, slotIndex: change.slotIndex, customHours,
        } satisfies AssignmentSummary);
      }
      next[key] = list;
    }
    return next;
  }, [data.assignments, data.employees, data.capacity, changes]);

  const savedAt = (slot: SlotRef) =>
    data.assignments[createAssignmentCellKey(slot)]?.find(a => a.slotIndex === slot.slotIndex);
  const savedEmployeeAt = (slot: SlotRef) => savedAt(slot)?.employeeId ?? null;
  const sameHours = (a?: CustomHours | null, b?: CustomHours | null) =>
    (a?.startTime ?? '') === (b?.startTime ?? '') && (a?.endTime ?? '') === (b?.endTime ?? '');

  /** Effective cells of an employee on a date, with their custom hours. */
  const cellsOf = (employeeId: string, date: string) => Object.entries(assignments)
    .filter(([key]) => key.startsWith(`${date}-`))
    .flatMap(([, list]) => list.filter(a => a.employeeId === employeeId)
      .map(a => ({ slot: { date, shiftType: a.shiftType, positionId: a.positionId, slotIndex: a.slotIndex } as SlotRef, customHours: a.customHours })));

  const setSlot = (slot: SlotRef, employeeId: string | null) => {
    setError(null);
    // Joining a day on which the employee already works custom hours extends that same shift.
    const hours = employeeId ? cellsOf(employeeId, slot.date).find(c => c.customHours)?.customHours : undefined;
    setChanges(current => {
      const next = new Map(current);
      const id = slotId(slot);
      const saved = savedAt(slot);
      // Back to the saved value: nothing left to save for this slot.
      if ((saved?.employeeId ?? null) === employeeId && (!hours || sameHours(saved?.customHours, hours))) next.delete(id);
      else next.set(id, { date: slot.date, shiftType: slot.shiftType, positionId: slot.positionId, slotIndex: slot.slotIndex, employeeId, ...(hours ? { hours } : {}) });
      return next;
    });
  };

  const setHours = (slot: SlotRef, hours: CustomHours | null) => {
    const employeeId = assignments[createAssignmentCellKey(slot)]?.find(a => a.slotIndex === slot.slotIndex)?.employeeId;
    if (!employeeId) return;
    setError(null);
    setChanges(current => {
      const next = new Map(current);
      for (const cell of cellsOf(employeeId, slot.date)) {
        const id = slotId(cell.slot);
        const saved = savedAt(cell.slot);
        if (saved?.employeeId === employeeId && sameHours(saved.customHours, hours)) next.delete(id);
        else next.set(id, { ...cell.slot, employeeId, hours });
      }
      return next;
    });
  };

  const swapWith = (slot: SlotRef, otherAssignmentId: string) => {
    const mine = assignments[createAssignmentCellKey(slot)]?.find(a => a.slotIndex === slot.slotIndex);
    const other = Object.values(assignments).flat().find(a => a.id === otherAssignmentId);
    if (!mine || !other) return;
    const otherSlot: SlotRef = { date: slotDate(assignments, other), shiftType: other.shiftType, positionId: other.positionId, slotIndex: other.slotIndex };
    setError(null);
    setChanges(current => {
      const next = new Map(current);
      for (const [target, employeeId] of [[slot, other.employeeId], [otherSlot, mine.employeeId]] as const) {
        const id = slotId(target);
        if (savedEmployeeAt(target) === employeeId) next.delete(id);
        else next.set(id, { date: target.date, shiftType: target.shiftType, positionId: target.positionId, slotIndex: target.slotIndex, employeeId });
      }
      return next;
    });
  };

  const dirty = changes.size > 0;

  // Warn before leaving with unsaved changes: closing the tab, and in-app link clicks.
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.origin !== window.location.origin) return;
      if (!window.confirm('יש שינויים שלא נשמרו. לצאת בלי לשמור?')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  async function save() {
    setSaving(true); setError(null);
    try {
      const update = await saveScheduleChanges(data.scheduleId, expected, [...changes.values()]);
      await applyScheduleEdit(queryClient, update);
      setChanges(new Map());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שמירת השיבוץ נכשלה');
    } finally { setSaving(false); }
  }

  const value = useMemo<PendingEdits>(() => ({
    assignments, setSlot, setHours, swapWith, isDirty: slot => changes.has(slotId(slot)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [assignments, changes]);

  return (
    <PendingEditsContext.Provider value={value}>
      {children}
      {dirty && (
        <div className="sticky bottom-0 z-30 -mx-1 flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 shadow-lg" dir="rtl" role="region" aria-label="שינויים שלא נשמרו">
          <span className="text-sm font-medium">{changes.size === 1 ? 'שינוי אחד שלא נשמר' : `${changes.size} שינויים שלא נשמרו`}</span>
          {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
          <div className="ms-auto flex gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => { setChanges(new Map()); setError(null); }}>ביטול שינויים</Button>
            <Button type="button" disabled={saving} onClick={save}>{saving ? 'שומר...' : 'שמירה'}</Button>
          </div>
        </div>
      )}
    </PendingEditsContext.Provider>
  );
}

/** The cell key starts with the ISO date; recover it for an assignment found by id. */
function slotDate(assignments: AssignmentMap, target: AssignmentSummary) {
  for (const [key, list] of Object.entries(assignments)) if (list.includes(target)) return key.slice(0, 10);
  return '';
}
