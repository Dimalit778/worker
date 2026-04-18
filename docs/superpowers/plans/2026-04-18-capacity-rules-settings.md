# Capacity Rules Settings Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a manager set per-court MORNING/EVENING/NIGHT max-staff rules via a dedicated `/manager/settings` page, with the server action scoped to their own court exclusively.

**Architecture:** Add `upsertCapacityRules` server action + `getCapacityRules` query, create a `CapacityRulesForm` client component, wire it into a new settings page, and add a nav link. The court is always read from the session — never from the client.

**Tech Stack:** Next.js 15 (App Router, Server Actions), Prisma, React `useTransition`, Vitest for unit tests, Tailwind + shadcn/ui.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/features/shibutz/actions.ts` | Modify | Add `upsertCapacityRules` server action |
| `src/features/shibutz/queries.ts` | Modify | Add `getCapacityRules` query |
| `src/features/shibutz/components/capacity-rules-form.tsx` | Create | Client form for editing rules |
| `src/app/(manager)/manager/settings/page.tsx` | Create | Settings server page |
| `src/app/(manager)/layout.tsx` | Modify | Add `הגדרות` nav link |
| `tests/capacity-rules.test.ts` | Create | Unit tests for `getCapacityRules` merge logic |

---

## Task 1: Unit-test `getCapacityRules` merge logic

The `getCapacityRules` function needs to merge DB rows with the `DEFAULT_CAPACITY` fallback. Test this logic in isolation before writing the implementation.

**Files:**
- Create: `tests/capacity-rules.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/capacity-rules.test.ts
import { describe, it, expect } from 'vitest';
import { mergeCapacityRules } from '@/features/shibutz/queries';
import type { CapacityMap } from '@/features/shibutz/types';

const DEFAULT: CapacityMap = { MORNING: 15, EVENING: 6, NIGHT: 3 };

describe('mergeCapacityRules', () => {
  it('returns defaults when no rules provided', () => {
    expect(mergeCapacityRules([], DEFAULT)).toEqual({ MORNING: 15, EVENING: 6, NIGHT: 3 });
  });

  it('overrides a single shift type', () => {
    const rules = [{ shiftType: 'MORNING' as const, maxStaff: 20 }];
    expect(mergeCapacityRules(rules, DEFAULT)).toEqual({ MORNING: 20, EVENING: 6, NIGHT: 3 });
  });

  it('overrides all shift types', () => {
    const rules = [
      { shiftType: 'MORNING' as const, maxStaff: 10 },
      { shiftType: 'EVENING' as const, maxStaff: 4 },
      { shiftType: 'NIGHT' as const, maxStaff: 2 },
    ];
    expect(mergeCapacityRules(rules, DEFAULT)).toEqual({ MORNING: 10, EVENING: 4, NIGHT: 2 });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/capacity-rules.test.ts
```

Expected: FAIL — `mergeCapacityRules is not exported`

---

## Task 2: Add `mergeCapacityRules` and `getCapacityRules` to queries

**Files:**
- Modify: `src/features/shibutz/queries.ts`

- [ ] **Step 1: Export `mergeCapacityRules` and add `getCapacityRules`**

Add after the `DEFAULT_CAPACITY` constant (line 5):

```ts
export function mergeCapacityRules(
  rules: { shiftType: 'MORNING' | 'EVENING' | 'NIGHT'; maxStaff: number }[],
  defaults: CapacityMap,
): CapacityMap {
  const result = { ...defaults };
  for (const rule of rules) {
    result[rule.shiftType] = rule.maxStaff;
  }
  return result;
}

export async function getCapacityRules(courtId: string): Promise<CapacityMap> {
  if (!courtId) return { ...DEFAULT_CAPACITY };
  const rows = await prisma.shiftCapacityRule.findMany({
    where: { courtId, dayOfWeek: null },
    select: { shiftType: true, maxStaff: true },
  });
  return mergeCapacityRules(rows, DEFAULT_CAPACITY);
}
```

Also update the existing `getShibutzPageData` to use `mergeCapacityRules` so both share the same logic. Replace lines 51–54:

```ts
  const capacity: CapacityMap = mergeCapacityRules(
    capacityRules.filter((r) => r.dayOfWeek === null),
    DEFAULT_CAPACITY,
  );
```

- [ ] **Step 2: Run the unit test to confirm it passes**

```bash
npx vitest run tests/capacity-rules.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 3: Commit**

```bash
git add src/features/shibutz/queries.ts tests/capacity-rules.test.ts
git commit -m "feat: add mergeCapacityRules helper and getCapacityRules query"
```

---

## Task 3: Add `upsertCapacityRules` server action

**Files:**
- Modify: `src/features/shibutz/actions.ts`

- [ ] **Step 1: Add the action at the end of the file**

```ts
type CapacityRulesInput = { MORNING: number; EVENING: number; NIGHT: number };

export async function upsertCapacityRules(
  rules: CapacityRulesInput,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.primaryCourtId;
  if (!courtId) return { error: 'למנהל אין בית משפט משויך' };

  const shiftTypes: ShiftType[] = ['MORNING', 'EVENING', 'NIGHT'];

  await prisma.$transaction(
    shiftTypes.map((shiftType) =>
      prisma.shiftCapacityRule.upsert({
        where: { courtId_shiftType_dayOfWeek: { courtId, shiftType, dayOfWeek: null } },
        create: { courtId, shiftType, dayOfWeek: null, minStaff: 0, maxStaff: rules[shiftType as keyof CapacityRulesInput] },
        update: { maxStaff: rules[shiftType as keyof CapacityRulesInput] },
      }),
    ),
  );

  revalidatePath('/manager/settings');
  revalidatePath('/manager/shibutz');
  return { ok: true };
}
```

Note: `ShiftType` and `revalidatePath` are already imported at the top of the file. No new imports needed.

- [ ] **Step 2: Check for linter errors**

```bash
npx tsc --noEmit 2>&1 | grep actions.ts
```

Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/features/shibutz/actions.ts
git commit -m "feat: add upsertCapacityRules server action"
```

---

## Task 4: Create `CapacityRulesForm` client component

**Files:**
- Create: `src/features/shibutz/components/capacity-rules-form.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useTransition, useState } from 'react';
import { Button } from '@/components/ui/button';
import { upsertCapacityRules } from '@/features/shibutz/actions';
import type { CapacityMap } from '@/features/shibutz/types';

export function CapacityRulesForm({ initialValues }: { initialValues: CapacityMap }) {
  const [values, setValues] = useState(initialValues);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleChange(shift: keyof CapacityMap, raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1) setValues((v) => ({ ...v, [shift]: n }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('idle');
    startTransition(async () => {
      const result = await upsertCapacityRules(values);
      if ('error' in result) {
        setStatus('error');
        setErrorMsg(result.error);
      } else {
        setStatus('ok');
      }
    });
  }

  const LABELS: { key: keyof CapacityMap; label: string }[] = [
    { key: 'MORNING', label: 'בוקר' },
    { key: 'EVENING', label: 'ערב' },
    { key: 'NIGHT', label: 'לילה' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xs">
      {LABELS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-3">
          <label className="w-16 text-sm font-medium text-right">{label}</label>
          <input
            type="number"
            min={1}
            value={values[key]}
            onChange={(e) => handleChange(key, e.target.value)}
            className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">מקס׳ עובדים</span>
        </div>
      ))}

      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? 'שומר...' : 'שמור שינויים'}
      </Button>

      {status === 'ok' && <p className="text-sm text-green-600">הגדרות נשמרו בהצלחה</p>}
      {status === 'error' && <p className="text-sm text-destructive">{errorMsg}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Check for linter errors**

```bash
npx tsc --noEmit 2>&1 | grep capacity-rules-form
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add src/features/shibutz/components/capacity-rules-form.tsx
git commit -m "feat: add CapacityRulesForm client component"
```

---

## Task 5: Create the settings page and add nav link

**Files:**
- Create: `src/app/(manager)/manager/settings/page.tsx`
- Modify: `src/app/(manager)/layout.tsx`

- [ ] **Step 1: Create the settings page**

```tsx
// src/app/(manager)/manager/settings/page.tsx
import { requireSession } from '@/lib/auth-helpers';
import { SystemRole } from '@/generated/prisma/client';
import { getCapacityRules } from '@/features/shibutz/queries';
import { CapacityRulesForm } from '@/features/shibutz/components/capacity-rules-form';

export default async function ManagerSettingsPage() {
  const session = await requireSession(SystemRole.MANAGER);
  const courtId = session.user.primaryCourtId ?? '';
  const capacity = await getCapacityRules(courtId);

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-muted-foreground">הגדרות בית המשפט שלך</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">כללי קיבולת משמרות</h2>
        <p className="text-sm text-muted-foreground">
          מספר המקסימלי של עובדים לכל סוג משמרת בבית המשפט שלך.
        </p>
        <CapacityRulesForm initialValues={capacity} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add nav link in manager layout**

In `src/app/(manager)/layout.tsx`, update the `navItems` array:

```ts
const navItems = [
  { href: '/manager', label: 'לוח בקרה' },
  { href: '/manager/shibutz', label: 'שיבוץ' },
  { href: '/manager/periods', label: 'תקופות' },
  { href: '/manager/guards', label: 'מאבטחים' },
  { href: '/manager/settings', label: 'הגדרות' },
];
```

- [ ] **Step 3: Check for type errors**

```bash
npx tsc --noEmit 2>&1 | grep -E "settings|capacity"
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add src/app/(manager)/manager/settings/page.tsx src/app/(manager)/layout.tsx
git commit -m "feat: add manager settings page with nav link"
```

---

## Task 6: Full test run and smoke check

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all existing tests pass, plus the 3 new `capacity-rules.test.ts` tests.

- [ ] **Step 2: Type-check the whole project**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke check**

1. Start the dev server: `npm run dev`
2. Log in as a manager.
3. Navigate to `/manager/settings` — page should load with the current values (or defaults: בוקר=15, ערב=6, לילה=3).
4. Change MORNING to `8`, click "שמור שינויים" — success message shown.
5. Navigate to `/manager/shibutz` — MORNING section should now show 8 rows.
6. Log in as a second manager with a different court — their settings should be independent.
