# Employee Warnings & Availability Summary Bar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat warnings panel and separate availability cards on the future-schedule page with a unified stat-cards row that reveals employee-grouped warnings on click.

**Architecture:** A new `ScheduleSummaryBar` client component (inside the header card) renders three stat cards. Clicking the error or warning card toggles a collapsible `EmployeeWarningsPanel` card between the header and the schedule grid. Grouping logic lives in a pure utility function so it can be unit-tested independently of React.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Vitest (test runner already configured)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `src/features/schedules/components/schedule-summary-bar.tsx` | Client component: stat cards + collapsible warnings panel |
| **Modify** | `src/features/schedules/components/warnings-panel.tsx` | Replace entire file — becomes the `EmployeeWarningsPanel` sub-component only |
| **Modify** | `src/app/(manager)/manager/future-schedule/page.tsx` | Wire new components, remove old availability cards + WarningsPanel |
| **Create** | `src/features/schedules/warnings-utils.ts` | Pure grouping function: `groupWarningsByEmployee` |
| **Create** | `tests/warnings-utils.test.ts` | Vitest unit tests for the grouping function |

---

## Task 1 — Pure grouping utility + tests

**Files:**
- Create: `src/features/schedules/warnings-utils.ts`
- Create: `tests/warnings-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/warnings-utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { groupWarningsByEmployee } from '@/features/schedules/warnings-utils';
import type { ScheduleWarningSummary } from '@/features/schedules/types';

const make = (overrides: Partial<ScheduleWarningSummary>): ScheduleWarningSummary => ({
  id: 'w1',
  type: 'UNFILLED',
  severity: 'WARNING',
  message: '',
  date: '2026-05-22',
  shiftType: 'MORNING',
  employeeName: 'דוד לוי',
  positionName: 'אחמ"ש',
  ...overrides,
});

describe('groupWarningsByEmployee', () => {
  it('returns empty array for empty input', () => {
    expect(groupWarningsByEmployee([])).toEqual([]);
  });

  it('groups warnings by employeeName', () => {
    const warnings = [
      make({ id: 'w1', employeeName: 'דוד לוי', severity: 'ERROR' }),
      make({ id: 'w2', employeeName: 'דוד לוי', severity: 'WARNING' }),
      make({ id: 'w3', employeeName: 'רחל כהן', severity: 'WARNING' }),
    ];
    const result = groupWarningsByEmployee(warnings);
    expect(result).toHaveLength(2);
    expect(result.find(g => g.employeeName === 'דוד לוי')?.warnings).toHaveLength(2);
    expect(result.find(g => g.employeeName === 'רחל כהן')?.warnings).toHaveLength(1);
  });

  it('sets worstSeverity to ERROR when group has any ERROR', () => {
    const warnings = [
      make({ id: 'w1', severity: 'ERROR' }),
      make({ id: 'w2', severity: 'INFO' }),
    ];
    const [group] = groupWarningsByEmployee(warnings);
    expect(group.worstSeverity).toBe('ERROR');
  });

  it('sets worstSeverity to WARNING when no ERROR', () => {
    const warnings = [
      make({ id: 'w1', severity: 'WARNING' }),
      make({ id: 'w2', severity: 'INFO' }),
    ];
    const [group] = groupWarningsByEmployee(warnings);
    expect(group.worstSeverity).toBe('WARNING');
  });

  it('sets worstSeverity to INFO when all INFO', () => {
    const [group] = groupWarningsByEmployee([make({ severity: 'INFO' })]);
    expect(group.worstSeverity).toBe('INFO');
  });

  it('skips warnings without employeeName', () => {
    const warnings = [
      make({ employeeName: null }),
      make({ employeeName: 'דוד לוי' }),
    ];
    const result = groupWarningsByEmployee(warnings);
    expect(result).toHaveLength(1);
  });

  it('sorts groups: ERROR first, then WARNING, then INFO', () => {
    const warnings = [
      make({ id: 'w1', employeeName: 'מיכאל', severity: 'INFO' }),
      make({ id: 'w2', employeeName: 'רחל', severity: 'WARNING' }),
      make({ id: 'w3', employeeName: 'דוד', severity: 'ERROR' }),
    ];
    const result = groupWarningsByEmployee(warnings);
    expect(result[0].worstSeverity).toBe('ERROR');
    expect(result[1].worstSeverity).toBe('WARNING');
    expect(result[2].worstSeverity).toBe('INFO');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run tests/warnings-utils.test.ts
```

Expected: FAIL — `Cannot find module '@/features/schedules/warnings-utils'`

- [ ] **Step 3: Create the utility**

Create `src/features/schedules/warnings-utils.ts`:

```ts
import type { WarningSeverity } from '@/generated/prisma/client';
import type { ScheduleWarningSummary } from './types';

export type EmployeeWarningGroup = {
  employeeName: string;
  positionName: string | null;
  warnings: ScheduleWarningSummary[];
  worstSeverity: WarningSeverity;
};

const SEVERITY_RANK: Record<WarningSeverity, number> = { ERROR: 0, WARNING: 1, INFO: 2 };

function worstOf(warnings: ScheduleWarningSummary[]): WarningSeverity {
  return warnings.reduce<WarningSeverity>(
    (best, w) => (SEVERITY_RANK[w.severity] < SEVERITY_RANK[best] ? w.severity : best),
    'INFO',
  );
}

export function groupWarningsByEmployee(warnings: ScheduleWarningSummary[]): EmployeeWarningGroup[] {
  const map = new Map<string, EmployeeWarningGroup>();

  for (const w of warnings) {
    if (!w.employeeName) continue;
    const existing = map.get(w.employeeName);
    if (existing) {
      existing.warnings.push(w);
    } else {
      map.set(w.employeeName, {
        employeeName: w.employeeName,
        positionName: w.positionName,
        warnings: [w],
        worstSeverity: w.severity,
      });
    }
  }

  // Recompute worstSeverity after all warnings are grouped
  const groups = Array.from(map.values()).map(g => ({ ...g, worstSeverity: worstOf(g.warnings) }));
  return groups.sort((a, b) => SEVERITY_RANK[a.worstSeverity] - SEVERITY_RANK[b.worstSeverity]);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/warnings-utils.test.ts
```

Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/schedules/warnings-utils.ts tests/warnings-utils.test.ts
git commit -m "feat: add groupWarningsByEmployee utility with tests"
```

---

## Task 2 — Replace `warnings-panel.tsx` with `EmployeeWarningsPanel`

**Files:**
- Modify: `src/features/schedules/components/warnings-panel.tsx` (full replacement)

This file becomes the `EmployeeWarningsPanel` component. It takes pre-grouped data and renders the B-style per-employee cards. It is no longer responsible for grouping or toggle state.

- [ ] **Step 1: Replace `warnings-panel.tsx` entirely**

```tsx
'use client';

import { AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHIFT_LABELS } from '@/features/schedules/constants';
import type { EmployeeWarningGroup } from '@/features/schedules/warnings-utils';
import type { WarningSeverity, WarningType } from '@/generated/prisma/client';

type Props = {
  groups: EmployeeWarningGroup[];
};

const WARNING_TYPE_LABELS: Record<WarningType, string> = {
  MIN_NOT_MET: 'מינימום משמרות לא הושלם',
  UNFILLED: 'תקן לא מאויש',
  UNDERSTAFFED: 'חוסר תקן',
  CONFLICT: 'התנגשות',
  FAIRNESS: 'הוגנות',
};

const SEVERITY_LABELS: Record<WarningSeverity, string> = {
  ERROR: 'שגיאה',
  WARNING: 'אזהרה',
  INFO: 'מידע',
};

const GROUP_STYLES: Record<WarningSeverity, { wrap: string; header: string; tag: string; bullet: string }> = {
  ERROR: {
    wrap: 'border-red-200 bg-red-50/60',
    header: 'text-red-700',
    tag: 'bg-red-100 text-red-700 border-red-200',
    bullet: 'text-red-300',
  },
  WARNING: {
    wrap: 'border-amber-200 bg-amber-50/60',
    header: 'text-amber-700',
    tag: 'bg-amber-100 text-amber-700 border-amber-200',
    bullet: 'text-amber-300',
  },
  INFO: {
    wrap: 'border-blue-200 bg-blue-50/60',
    header: 'text-blue-700',
    tag: 'bg-blue-100 text-blue-700 border-blue-200',
    bullet: 'text-blue-300',
  },
};

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}`;
}

function SeverityIcon({ severity, className }: { severity: WarningSeverity; className?: string }) {
  if (severity === 'INFO') return <Info className={cn('h-3.5 w-3.5', className)} />;
  return <AlertTriangle className={cn('h-3.5 w-3.5', className)} />;
}

export function EmployeeWarningsPanel({ groups }: Props) {
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" dir="rtl">
      {groups.map((group) => {
        const s = GROUP_STYLES[group.worstSeverity];
        const count = group.warnings.length;
        const label = count === 1 ? `1 ${SEVERITY_LABELS[group.worstSeverity]}` : `${count} בעיות`;

        return (
          <div
            key={group.employeeName}
            className={cn('rounded-xl border overflow-hidden', s.wrap)}
          >
            <div className={cn('flex items-center justify-between px-4 py-2.5', s.header)}>
              <span className="font-semibold text-sm">
                {group.employeeName}
                {group.positionName && (
                  <span className="font-normal opacity-70 mr-1.5 text-xs">· {group.positionName}</span>
                )}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
                  s.tag,
                )}
              >
                <SeverityIcon severity={group.worstSeverity} />
                {label}
              </span>
            </div>
            <div className="border-t border-black/5 px-4 py-2 flex flex-col gap-1">
              {group.warnings.map((w) => {
                const context = [
                  w.date ? formatDate(w.date) : null,
                  w.shiftType ? SHIFT_LABELS[w.shiftType] : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <p key={w.id} className="text-xs text-foreground/75 flex gap-1.5 items-baseline">
                    <span className={cn('text-base leading-none', s.bullet)} aria-hidden>·</span>
                    <span>
                      {WARNING_TYPE_LABELS[w.type]}
                      {context && <span className="text-muted-foreground mr-1">— {context}</span>}
                    </span>
                  </p>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/schedules/components/warnings-panel.tsx
git commit -m "refactor: replace WarningsPanel with EmployeeWarningsPanel grouped by employee"
```

---

## Task 3 — Create `ScheduleSummaryBar` component

**Files:**
- Create: `src/features/schedules/components/schedule-summary-bar.tsx`

This is the client component that owns the toggle state and renders the 3 stat cards plus the collapsible panel.

- [ ] **Step 1: Create the component**

Create `src/features/schedules/components/schedule-summary-bar.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { EmployeeWarningsPanel } from './warnings-panel';
import { groupWarningsByEmployee } from '@/features/schedules/warnings-utils';
import type { ScheduleWarningSummary } from '@/features/schedules/types';

type ActivePanel = 'errors' | 'warnings' | null;

type Props = {
  warnings: ScheduleWarningSummary[];
  submittedCount: number;
  eligibleCount: number;
};

export function ScheduleSummaryBar({ warnings, submittedCount, eligibleCount }: Props) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const errorWarnings = warnings.filter((w) => w.severity === 'ERROR');
  const otherWarnings = warnings.filter((w) => w.severity !== 'ERROR');
  const errorCount = errorWarnings.length;
  const warningCount = otherWarnings.length;

  const pct = eligibleCount > 0 ? Math.min(100, Math.round((submittedCount / eligibleCount) * 100)) : 0;

  function toggle(panel: ActivePanel) {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }

  const activeGroups =
    activePanel === 'errors'
      ? groupWarningsByEmployee(errorWarnings)
      : activePanel === 'warnings'
        ? groupWarningsByEmployee(otherWarnings)
        : [];

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {/* Submissions — spans full width on mobile */}
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">הגשות זמינות</p>
          <p className="mt-1 tabular-nums">
            <span className="text-2xl font-bold tracking-tight">{submittedCount}</span>
            <span className="text-sm text-muted-foreground"> / {eligibleCount}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${pct} אחוז הגישו זמינות`}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">{pct}% מהעובדים הגישו</p>
        </div>

        {/* Errors */}
        <button
          type="button"
          onClick={() => toggle('errors')}
          disabled={errorCount === 0}
          className={cn(
            'rounded-xl border px-4 py-3 text-right transition-all',
            errorCount === 0
              ? 'border-border/40 bg-muted/20 cursor-default'
              : 'cursor-pointer hover:-translate-y-px hover:shadow-md active:translate-y-0',
            activePanel === 'errors'
              ? 'border-red-400 bg-red-50 ring-2 ring-red-400'
              : errorCount > 0
                ? 'border-red-200 bg-red-50/60'
                : '',
          )}
        >
          <p className={cn('text-xs font-medium', errorCount > 0 ? 'text-red-600' : 'text-muted-foreground')}>
            שגיאות קריטיות
          </p>
          <p
            className={cn(
              'mt-1 text-2xl font-bold tracking-tight tabular-nums',
              errorCount > 0 ? 'text-red-600' : 'text-muted-foreground',
            )}
          >
            {errorCount}
          </p>
          {errorCount > 0 && (
            <p className="mt-1.5 text-xs text-red-400">{activePanel === 'errors' ? 'לחץ לסגירה ↑' : 'לחץ לפרטים ↓'}</p>
          )}
        </button>

        {/* Warnings + info */}
        <button
          type="button"
          onClick={() => toggle('warnings')}
          disabled={warningCount === 0}
          className={cn(
            'rounded-xl border px-4 py-3 text-right transition-all',
            warningCount === 0
              ? 'border-border/40 bg-muted/20 cursor-default'
              : 'cursor-pointer hover:-translate-y-px hover:shadow-md active:translate-y-0',
            activePanel === 'warnings'
              ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400'
              : warningCount > 0
                ? 'border-amber-200 bg-amber-50/60'
                : '',
          )}
        >
          <p className={cn('text-xs font-medium', warningCount > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
            אזהרות
          </p>
          <p
            className={cn(
              'mt-1 text-2xl font-bold tracking-tight tabular-nums',
              warningCount > 0 ? 'text-amber-600' : 'text-muted-foreground',
            )}
          >
            {warningCount}
          </p>
          {warningCount > 0 && (
            <p className="mt-1.5 text-xs text-amber-400">
              {activePanel === 'warnings' ? 'לחץ לסגירה ↑' : 'לחץ לפרטים ↓'}
            </p>
          )}
        </button>
      </div>

      {/* Collapsible employee warnings panel */}
      {activePanel !== null && activeGroups.length > 0 && (
        <Card className="rounded-xl shadow-none border-border/60 animate-in fade-in slide-in-from-top-1 duration-150">
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              {activePanel === 'errors' ? 'שגיאות לפי עובד' : 'אזהרות לפי עובד'}
            </p>
            <EmployeeWarningsPanel groups={activeGroups} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/schedules/components/schedule-summary-bar.tsx
git commit -m "feat: add ScheduleSummaryBar with collapsible employee warnings panel"
```

---

## Task 4 — Wire into the future-schedule page

**Files:**
- Modify: `src/app/(manager)/manager/future-schedule/page.tsx`

- [ ] **Step 1: Update the page**

Replace the entire file content with:

```tsx
import { requireSession } from '@/lib/db/auth-helpers';
import { SystemRole, type ScheduleStatus } from '@/generated/prisma/client';
import { getFutureScheduleData } from '@/features/schedules/assignments/quries';
import { Schedule } from '@/features/schedules/assignments/components/schedule';
import { DraftActions } from '@/features/schedules/components/draft-actions';
import { ScheduleSummaryBar } from '@/features/schedules/components/schedule-summary-bar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { STATUS_COLORS, STATUS_LABELS } from '@/features/schedules/constants';
import { cn } from '@/lib/utils';

function ScheduleStatusBadge({ status }: { status: ScheduleStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex rounded-md border border-dashed border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
        אין לוח שיבוץ
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-2 py-0.5 text-xs font-medium',
        STATUS_COLORS[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default async function FutureSchedulePage() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.courtId ?? '';

  const data = await getFutureScheduleData(courtId);

  if (!data.found) {
    return (
      <div className="space-y-4" dir="rtl">
        <Card size="sm" className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">שיבוץ בהכנה</CardTitle>
            <CardDescription className="text-base">{data.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const isReadonly = data.scheduleStatus === 'PUBLISHED';
  const submission = data.availabilitySubmissionSummary;

  return (
    <div className="space-y-6" dir="rtl">
      <Card size="sm" className="shadow-sm">
        <CardHeader className="border-b border-border/50 space-y-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl font-semibold">שיבוץ בהכנה</CardTitle>
                <ScheduleStatusBadge status={data.scheduleStatus} />
              </div>
              <CardDescription className="text-[0.9375rem] leading-relaxed">
                <span className="font-medium text-foreground/90">{data.periodName}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {data.startDate} – {data.endDate}
                </span>
              </CardDescription>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <DraftActions
                periodId={data.periodId}
                scheduleId={data.scheduleId}
                scheduleStatus={data.scheduleStatus}
              />
            </div>
          </div>
        </CardHeader>

        {submission !== undefined && (
          <CardContent className="pt-4">
            <ScheduleSummaryBar
              warnings={data.warnings}
              submittedCount={submission.submittedCount}
              eligibleCount={submission.eligibleEmployeeCount}
            />
          </CardContent>
        )}
      </Card>

      {isReadonly && (
        <div
          className="flex gap-3 rounded-2xl border border-green-200/80 bg-green-50 px-4 py-3 text-sm text-green-900 shadow-sm ring-1 ring-green-100"
          role="status"
        >
          <span className="select-none text-base leading-none" aria-hidden>
            ✓
          </span>
          <p className="leading-snug">
            השיבוץ פורסם ומוצג לכלל העובדים. לעריכה נוספת יש לפנות להגדרות.
          </p>
        </div>
      )}

      <Schedule
        periodId={data.periodId}
        periodName={data.periodName}
        startDate={data.startDate}
        endDate={data.endDate}
        scheduleId={data.scheduleId}
        scheduleStatus={data.scheduleStatus}
        assignments={data.assignments}
        employees={data.employees}
        capacity={data.capacity}
        courtId={data.courtId}
        overflowCandidates={data.overflowCandidates}
        readonly={isReadonly}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/app/(manager)/manager/future-schedule/page.tsx
git commit -m "feat: wire ScheduleSummaryBar into future-schedule page, remove old availability cards"
```

---

## Task 5 — Verify end-to-end

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (including the new warnings-utils tests).

- [ ] **Step 2: Start dev server and open the page**

```bash
npm run dev
```

Open `http://localhost:3000/manager/future-schedule` in the browser.

Check:
- Header card shows 3 stat cards: submissions progress bar, error count (red), warning count (amber)
- Clicking the error card reveals a panel with employee-grouped error warnings
- Clicking the same card again closes the panel
- Clicking the warning card swaps the panel to warning/info groups
- On a narrow window (< 520px), submissions card spans full width; error and warning share a row
- If a period has no schedule yet (no warnings), the error/warning cards show `0` and are not clickable
