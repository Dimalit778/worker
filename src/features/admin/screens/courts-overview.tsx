'use client';

import { useRef, useState } from 'react';
import { Building2, Search, Users, X } from 'lucide-react';

import type { AdminCourtsData, AdminCourtItem, AdminRegionItem } from '@/features/admin/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PositionSummary = {
  id: string;
  name: string;
  color: string | null;
  total: number;
  active: number;
  inactive: number;
};

function buildPositionSummaries(court: AdminCourtItem): PositionSummary[] {
  return court.positions
    .filter((p) => p.isActive)
    .map((position) => {
      const inPosition = court.employees.filter((e) => e.position.id === position.id);
      const active = inPosition.filter((e) => e.isActive).length;
      const inactive = inPosition.filter((e) => !e.isActive).length;
      return {
        id: position.id,
        name: position.name,
        color: null,
        total: inPosition.length,
        active,
        inactive,
      };
    });
}

function CourtCard({ court }: { court: AdminCourtItem }) {
  const summaries = buildPositionSummaries(court);
  const totalActive = court.employees.filter((e) => e.isActive).length;
  const totalInactive = court.employees.filter((e) => !e.isActive).length;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold truncate">{court.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{court.employees.length}</span>
          </div>
        </div>
        <div className="flex gap-2 mt-1">
          <Badge variant="secondary" className="text-xs">
            {totalActive} פעילים
          </Badge>
          {totalInactive > 0 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {totalInactive} לא פעילים
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        {summaries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">אין תפקידים פעילים</p>
        ) : (
          <div className="space-y-1.5">
            {summaries.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground truncate">{s.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-medium tabular-nums">{s.total}</span>
                  {s.inactive > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">({s.inactive} לא פעיל)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type Props = {
  data: AdminCourtsData;
};

export function CourtsOverview({ data }: Props) {
  const [query, setQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<AdminRegionItem | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = query.trim()
    ? data.regions.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  function selectRegion(region: AdminRegionItem) {
    setSelectedRegion(region);
    setQuery(region.name);
    setOpen(false);
    inputRef.current?.blur();
  }

  function clearSelection() {
    setSelectedRegion(null);
    setQuery('');
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Region search combobox */}
      <div className="relative max-w-xs">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder="חיפוש מחוז..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedRegion(null);
            setOpen(true);
          }}
          onFocus={() => { if (query && !selectedRegion) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="pr-9 pl-8"
        />
        {query && (
          <button
            onClick={clearSelection}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {open && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
            {suggestions.map((region) => (
              <li
                key={region.id}
                onMouseDown={() => selectRegion(region)}
                className={cn(
                  'flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-muted',
                )}
              >
                <span>{region.name}</span>
                <span className="text-xs text-muted-foreground">{region.courts.length} בתי משפט</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Courts */}
      {!selectedRegion ? (
        <p className="text-muted-foreground text-sm">בחר מחוז כדי לראות את בתי המשפט.</p>
      ) : selectedRegion.courts.length === 0 ? (
        <p className="text-muted-foreground text-sm">אין בתי משפט במחוז זה.</p>
      ) : (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">{selectedRegion.name}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {selectedRegion.courts.map((court) => (
              <CourtCard key={court.id} court={court} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
