'use client';

import { useRef, useState } from 'react';
import { ChevronDown, Search, Users, X } from 'lucide-react';

import type { AdminCourtsData, AdminCourtItem } from '@/features/admin/types';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { EmployeesListScreen } from '@/features/employess/EmployeesListScreen';

type Props = {
  data: AdminCourtsData;
};

export function EmployeesOverview({ data }: Props) {
  const allCourts = data.regions.flatMap((r) => r.courts);

  const [query, setQuery] = useState('');
  const [selectedCourt, setSelectedCourt] = useState<AdminCourtItem | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCourts = query.trim()
    ? allCourts.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : allCourts;

  function selectCourt(court: AdminCourtItem) {
    setSelectedCourt(court);
    setQuery(court.name);
    setOpen(false);
    inputRef.current?.blur();
  }

  function clearSelection() {
    setSelectedCourt(null);
    setQuery('');
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">עובדים</h1>
        <p className="mt-1 text-sm text-muted-foreground">בחר בית משפט כדי לראות את רשימת העובדים.</p>
      </div>

      {/* Court search combobox */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder="חיפוש בית משפט..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedCourt(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="pr-9 pl-9"
        />
        {query ? (
          <button
            onClick={clearSelection}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        )}

        {open && filteredCourts.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md">
            {filteredCourts.map((court) => {
              const region = data.regions.find((r) => r.id === court.regionId);
              return (
                <li
                  key={court.id}
                  onMouseDown={() => selectCourt(court)}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-muted',
                    selectedCourt?.id === court.id && 'bg-muted',
                  )}
                >
                  <div className="min-w-0">
                    <span className="block font-medium truncate">{court.name}</span>
                    {region && <span className="block text-xs text-muted-foreground">{region.name}</span>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ms-3 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {court.employeeCount}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {open && query.trim() && filteredCourts.length === 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover px-3 py-4 shadow-md text-sm text-center text-muted-foreground">
            לא נמצאו בתי משפט
          </div>
        )}
      </div>

      {/* Content */}
      {!selectedCourt ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed py-16 text-sm text-muted-foreground">
          בחר בית משפט כדי לראות את העובדים
        </div>
      ) : (
        <EmployeesListScreen courtId={selectedCourt.id} />
      )}
    </div>
  );
}
