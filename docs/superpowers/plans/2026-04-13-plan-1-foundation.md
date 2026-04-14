# Court Guard Scheduler — Plan 1: Foundation & Auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Next.js project with full database schema, authentication, role-based middleware, and layout shells for both the guard and manager surfaces.

**Architecture:** Single Next.js 14 App Router monorepo. PostgreSQL via Prisma ORM. NextAuth v4 with credentials provider (email+password) and JWT sessions. Route groups provide separate layouts for guard (mobile RTL) and manager (desktop RTL) surfaces. Middleware enforces role-based access at the edge.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS v3 (RTL), shadcn/ui, Prisma 5, NextAuth v4, bcryptjs, Vitest, @testing-library/react

**Spec reference:** `docs/superpowers/specs/2026-04-13-court-guard-scheduler-design.md`

---

## File Map

```
worker/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.ts
├── components.json                        (shadcn config)
├── vitest.config.ts
├── vitest.setup.ts
├── prisma/
│   ├── schema.prisma                      (all 12 entities)
│   └── seed.ts                            (manager, courts, guards, config)
├── src/
│   ├── types/
│   │   └── next-auth.d.ts                 (extend Session/JWT with role)
│   ├── middleware.ts                       (role-based route protection)
│   ├── lib/
│   │   ├── auth.ts                        (NextAuth options)
│   │   ├── auth-helpers.ts                (getRequiredSession, assertRole)
│   │   └── db/
│   │       └── client.ts                  (Prisma singleton)
│   ├── app/
│   │   ├── layout.tsx                     (root: html dir=rtl lang=he)
│   │   ├── page.tsx                       (root redirect by role)
│   │   ├── api/
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts
│   │   ├── (auth)/
│   │   │   ├── layout.tsx                 (centered, no nav)
│   │   │   └── login/
│   │   │       ├── page.tsx               (server: redirect if authed)
│   │   │       └── LoginForm.tsx          (client: form + signIn)
│   │   ├── (guard)/
│   │   │   ├── layout.tsx                 (mobile nav, primary court label)
│   │   │   └── guard/
│   │   │       └── page.tsx               (dashboard shell)
│   │   └── (manager)/
│   │       ├── layout.tsx                 (desktop sidebar nav)
│   │       └── manager/
│   │           └── page.tsx               (dashboard shell)
│   └── components/
│       └── ui/                            (shadcn: button, input, label, card)
└── tests/
    ├── auth-helpers.test.ts
    └── middleware-logic.test.ts
```

---

### Task 1: Git, package.json, and core config files

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `.env.example`

- [ ] **Step 1: Initialize git**

```bash
cd /Users/dimalitvinov/Mac/Dev/Projects/worker
git init
```

Expected: `Initialized empty Git repository in .git/`

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.next/
.env.local
.env
dist/
*.tsbuildinfo
```

- [ ] **Step 3: Create `package.json`**

```json
{
  "name": "court-guard-scheduler",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "test:run": "vitest run",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "next": "14.2.29",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@prisma/client": "^5.22.0",
    "next-auth": "^4.24.10",
    "@next-auth/prisma-adapter": "^1.0.7",
    "bcryptjs": "^2.4.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.468.0",
    "tailwind-merge": "^2.5.5",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^20.17.6",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/bcryptjs": "^2.4.6",
    "prisma": "^5.22.0",
    "tsx": "^4.19.2",
    "tailwindcss": "^3.4.14",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20",
    "vitest": "^2.1.4",
    "@vitejs/plugin-react": "^4.3.3",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.6.2",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.1"
  }
}
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Create `next.config.ts`**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

- [ ] **Step 6: Create `.env.example`**

```
DATABASE_URL="postgresql://user:password@localhost:5432/court_scheduler"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
```

- [ ] **Step 7: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: initialize Next.js 14 project with TypeScript"
```

---

### Task 2: Tailwind CSS + PostCSS + shadcn/ui

**Files:**
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `components.json`
- Create: `src/app/globals.css`
- Create: `src/lib/utils.ts`

- [ ] **Step 1: Create `tailwind.config.ts`**

Tailwind v3 has built-in RTL support via `rtl:` and `ltr:` variants when `dir="rtl"` is on the HTML element — no plugin needed.

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Create `postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 3: Create `components.json`** (shadcn config — skip interactive init)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 4: Create `src/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 5: Create `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

- [ ] **Step 6: Add shadcn Button, Input, Label, Card components**

Create `src/components/ui/button.tsx`:

```typescript
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

Create `src/components/ui/input.tsx`:

```typescript
import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export { Input }
```

Create `src/components/ui/label.tsx`:

```typescript
'use client'
import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
)

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
```

Create `src/components/ui/card.tsx`:

```typescript
import * as React from 'react'
import { cn } from '@/lib/utils'

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-xl border bg-card text-card-foreground shadow', className)} {...props} />
  )
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
  )
)
CardTitle.displayName = 'CardTitle'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

export { Card, CardHeader, CardTitle, CardContent }
```

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: add Tailwind CSS, PostCSS, and shadcn/ui base components"
```

---

### Task 3: Prisma schema

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ───────────────────────────────────────────────────────────────────

enum Role {
  GUARD
  MANAGER
}

enum ShiftType {
  MORNING
  EVENING
  NIGHT
}

enum PeriodStatus {
  DRAFT
  OPEN
  CLOSED
  PUBLISHED
}

enum ScheduleStatus {
  DRAFT
  PUBLISHED
}

enum WarningType {
  UNDERSTAFFED
  UNFILLED
  MIN_NOT_MET
  CONFLICT
  FAIRNESS
}

enum WarningSeverity {
  ERROR
  WARNING
  INFO
}

// ─── NextAuth models ─────────────────────────────────────────────────────────

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ─── Domain models ───────────────────────────────────────────────────────────

model User {
  id             String   @id @default(cuid())
  email          String   @unique
  passwordHash   String
  name           String
  phone          String?
  role           Role     @default(GUARD)
  primaryCourtId String?
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())

  primaryCourt     Court?             @relation("PrimaryCourtGuards", fields: [primaryCourtId], references: [id])
  courtEligibility CourtEligibility[]
  availability     Availability[]
  assignments      ShiftAssignment[]
  fairnessRecords  FairnessRecord[]
  periodsCreated   SchedulingPeriod[] @relation("PeriodCreatedBy")
  schedulesGenerated Schedule[]       @relation("ScheduleGeneratedBy")
  assignmentWarnings ScheduleWarning[] @relation("WarningUser")

  accounts Account[]
  sessions Session[]
}

model Court {
  id       String  @id @default(cuid())
  name     String
  code     String  @unique
  isActive Boolean @default(true)

  capacityRules    ShiftCapacityRule[]
  eligibility      CourtEligibility[]
  primaryGuards    User[]              @relation("PrimaryCourtGuards")
  availabilityEntries AvailabilityEntry[]
  assignments      ShiftAssignment[]
  warnings         ScheduleWarning[]   @relation("WarningCourt")
}

model CourtEligibility {
  id      String @id @default(cuid())
  userId  String
  courtId String

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  court Court @relation(fields: [courtId], references: [id], onDelete: Cascade)

  @@unique([userId, courtId])
}

model ShiftCapacityRule {
  id        String    @id @default(cuid())
  courtId   String
  shiftType ShiftType
  dayOfWeek Int?      // 0=Sunday … 6=Saturday; null = applies to all days
  minStaff  Int
  maxStaff  Int

  court Court @relation(fields: [courtId], references: [id], onDelete: Cascade)

  @@unique([courtId, shiftType, dayOfWeek])
}

model SchedulingPeriod {
  id                 String       @id @default(cuid())
  name               String
  startDate          DateTime     @db.Date
  endDate            DateTime     @db.Date
  submissionDeadline DateTime
  status             PeriodStatus @default(DRAFT)
  createdById        String
  createdAt          DateTime     @default(now())

  createdBy       User             @relation("PeriodCreatedBy", fields: [createdById], references: [id])
  availability    Availability[]
  schedules       Schedule[]
  fairnessRecords FairnessRecord[]
}

model Availability {
  id          String    @id @default(cuid())
  periodId    String
  userId      String
  isSubmitted Boolean   @default(false)
  submittedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  period  SchedulingPeriod  @relation(fields: [periodId], references: [id])
  user    User              @relation(fields: [userId], references: [id])
  entries AvailabilityEntry[]

  @@unique([periodId, userId])
}

model AvailabilityEntry {
  id             String    @id @default(cuid())
  availabilityId String
  date           DateTime  @db.Date
  courtId        String
  shiftType      ShiftType
  isAvailable    Boolean   @default(false)

  // courtId is auto-derived from the guard's primaryCourtId in V1.
  // The field is explicit in the schema to support multi-court in future versions.
  availability Availability @relation(fields: [availabilityId], references: [id], onDelete: Cascade)
  court        Court        @relation(fields: [courtId], references: [id])

  @@unique([availabilityId, date, courtId, shiftType])
}

model Schedule {
  id            String         @id @default(cuid())
  periodId      String
  status        ScheduleStatus @default(DRAFT)
  generatedAt   DateTime       @default(now())
  publishedAt   DateTime?
  generatedById String

  period      SchedulingPeriod  @relation(fields: [periodId], references: [id])
  generatedBy User              @relation("ScheduleGeneratedBy", fields: [generatedById], references: [id])
  assignments ShiftAssignment[]
  warnings    ScheduleWarning[]
}

model ShiftAssignment {
  id               String    @id @default(cuid())
  scheduleId       String
  userId           String
  courtId          String
  date             DateTime  @db.Date
  shiftType        ShiftType
  isOpeningDuty    Boolean   @default(false)
  isManualOverride Boolean   @default(false)
  createdAt        DateTime  @default(now())

  // DB rule: isOpeningDuty may only be true for MORNING shifts.
  // Enforced by CHECK constraint added in migration (see Task 4).
  // Partial unique index (scheduleId, date, courtId) WHERE isOpeningDuty = true
  // is also added in migration to ensure at most one opening duty per court per date.

  schedule Schedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id])
  court    Court    @relation(fields: [courtId], references: [id])

  @@unique([scheduleId, userId, date, shiftType])
}

model ScheduleWarning {
  id         String          @id @default(cuid())
  scheduleId String
  type       WarningType
  severity   WarningSeverity
  courtId    String?
  userId     String?
  date       DateTime?       @db.Date
  message    String

  schedule Schedule  @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  court    Court?    @relation("WarningCourt", fields: [courtId], references: [id])
  user     User?     @relation("WarningUser", fields: [userId], references: [id])
}

model FairnessRecord {
  id            String @id @default(cuid())
  userId        String
  periodId      String
  totalShifts   Int    @default(0)
  morningShifts Int    @default(0)
  eveningShifts Int    @default(0)
  nightShifts   Int    @default(0)
  weekendShifts Int    @default(0)
  openingDuties Int    @default(0)

  user   User             @relation(fields: [userId], references: [id])
  period SchedulingPeriod @relation(fields: [periodId], references: [id])

  @@unique([userId, periodId])
}

model SystemConfig {
  key   String @id
  value Json
}
```

- [ ] **Step 2: Commit schema before migrating**

```bash
git add prisma/schema.prisma
git commit -m "feat: add complete Prisma schema (12 entities)"
```

---

### Task 4: Database migration + manual constraints

**Files:**
- Modify: `prisma/migrations/<timestamp>_initial/migration.sql` (add CHECK + partial index)

- [ ] **Step 1: Create `.env.local` with your DATABASE_URL**

Create `.env.local` (not committed — already in `.gitignore`):

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/court_scheduler"
NEXTAUTH_SECRET="run: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
```

Replace the DATABASE_URL with your actual Postgres connection string (Neon, Railway, or local).

- [ ] **Step 2: Run the initial migration**

```bash
npx prisma migrate dev --name initial
```

Expected: Migration created in `prisma/migrations/`, client generated.

- [ ] **Step 3: Add DB-level constraints to the migration SQL**

Open the generated file at `prisma/migrations/<timestamp>_initial/migration.sql` and append to the end:

```sql
-- CHECK: isOpeningDuty may only be true for MORNING shifts
ALTER TABLE "ShiftAssignment"
  ADD CONSTRAINT "shift_assignment_opening_duty_morning_only"
  CHECK ("isOpeningDuty" = false OR "shiftType" = 'MORNING');

-- PARTIAL UNIQUE INDEX: at most one opening duty per court per date per schedule
CREATE UNIQUE INDEX "shift_assignment_one_opening_duty_per_court_date"
  ON "ShiftAssignment" ("scheduleId", "date", "courtId")
  WHERE "isOpeningDuty" = true;
```

- [ ] **Step 4: Apply the edited migration**

```bash
npx prisma migrate deploy
```

Expected: Migration applied. Verify with:

```bash
npx prisma studio
```

Open `http://localhost:5555` and confirm all tables exist.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: run initial DB migration with CHECK constraint and partial unique index"
```

---

### Task 5: Database seed

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Write `prisma/seed.ts`**

```typescript
import { PrismaClient, Role, ShiftType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // SystemConfig
  await prisma.systemConfig.upsert({
    where: { key: 'weekly_min_morning' },
    update: {},
    create: { key: 'weekly_min_morning', value: 2 },
  })
  await prisma.systemConfig.upsert({
    where: { key: 'weekly_min_evening' },
    update: {},
    create: { key: 'weekly_min_evening', value: 1 },
  })
  await prisma.systemConfig.upsert({
    where: { key: 'fairness_weights' },
    update: {},
    create: { key: 'fairness_weights', value: { W1: 3, W2: 2, W3: 1, W4: 1 } },
  })
  await prisma.systemConfig.upsert({
    where: { key: 'fairness_shift_threshold' },
    update: {},
    create: { key: 'fairness_shift_threshold', value: 2 },
  })
  await prisma.systemConfig.upsert({
    where: { key: 'fairness_opening_duty_threshold' },
    update: {},
    create: { key: 'fairness_opening_duty_threshold', value: 2 },
  })

  // Courts
  const courtA = await prisma.court.upsert({
    where: { code: 'DISTRICT_CENTER' },
    update: {},
    create: { name: 'בית משפט מחוזי – מרכז', code: 'DISTRICT_CENTER' },
  })
  const courtB = await prisma.court.upsert({
    where: { code: 'MAGISTRATE_TLV' },
    update: {},
    create: { name: 'בית משפט שלום – תל אביב', code: 'MAGISTRATE_TLV' },
  })

  // Shift capacity rules — deleteMany + createMany to avoid Postgres NULL unique issue.
  // PostgreSQL treats NULL != NULL in UNIQUE indexes, so upsert on (courtId, shiftType, NULL)
  // would insert duplicates on second seed run. Wipe + recreate is safe for seeding.
  await prisma.shiftCapacityRule.deleteMany({ where: { courtId: courtA.id } })
  await prisma.shiftCapacityRule.createMany({
    data: [
      { courtId: courtA.id, shiftType: ShiftType.MORNING, dayOfWeek: null, minStaff: 3, maxStaff: 5 },
      { courtId: courtA.id, shiftType: ShiftType.EVENING, dayOfWeek: null, minStaff: 2, maxStaff: 3 },
      { courtId: courtA.id, shiftType: ShiftType.NIGHT,   dayOfWeek: null, minStaff: 1, maxStaff: 1 },
    ],
  })

  await prisma.shiftCapacityRule.deleteMany({ where: { courtId: courtB.id } })
  await prisma.shiftCapacityRule.createMany({
    data: [
      { courtId: courtB.id, shiftType: ShiftType.MORNING, dayOfWeek: null, minStaff: 2, maxStaff: 3 },
      { courtId: courtB.id, shiftType: ShiftType.EVENING, dayOfWeek: null, minStaff: 1, maxStaff: 2 },
    ],
  })

  // Manager
  const managerHash = await bcrypt.hash('manager123', 12)
  const manager = await prisma.user.upsert({
    where: { email: 'manager@court.gov.il' },
    update: {},
    create: {
      email: 'manager@court.gov.il',
      passwordHash: managerHash,
      name: 'מנהל מערכת',
      role: Role.MANAGER,
    },
  })

  // Guards (primary court: courtA)
  const guardData = [
    { email: 'cohen@court.gov.il',   name: 'יובל כהן' },
    { email: 'levi@court.gov.il',    name: 'מיכל לוי' },
    { email: 'abed@court.gov.il',    name: 'ראמי עבד' },
    { email: 'shamir@court.gov.il',  name: 'עמית שמיר' },
    { email: 'nagar@court.gov.il',   name: 'דנה נגר' },
    { email: 'peretz@court.gov.il',  name: 'אלי פרץ' },
    { email: 'chaim@court.gov.il',   name: 'בן חיים' },
  ]
  const guardHash = await bcrypt.hash('guard123', 12)

  for (const g of guardData) {
    const guard = await prisma.user.upsert({
      where: { email: g.email },
      update: {},
      create: {
        email: g.email,
        passwordHash: guardHash,
        name: g.name,
        role: Role.GUARD,
        primaryCourtId: courtA.id,
      },
    })
    // Court eligibility
    await prisma.courtEligibility.upsert({
      where: { userId_courtId: { userId: guard.id, courtId: courtA.id } },
      update: {},
      create: { userId: guard.id, courtId: courtA.id },
    })
  }

  console.log('Seed complete.')
  console.log('Manager login: manager@court.gov.il / manager123')
  console.log('Guard login:   cohen@court.gov.il / guard123')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Run seed**

```bash
npm run db:seed
```

Expected output:
```
Seeding database...
Seed complete.
Manager login: manager@court.gov.il / manager123
Guard login:   cohen@court.gov.il / guard123
```

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: add database seed with courts, guards, and system config"
```

---

### Task 6: Vitest test infrastructure

**Files:**
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 2: Create `vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Create `tests/` directory with a smoke test**

Create `tests/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('test infrastructure', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run
```

Expected:
```
✓ tests/smoke.test.ts > test infrastructure > runs
Test Files  1 passed (1)
Tests       1 passed (1)
```

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts vitest.setup.ts tests/
git commit -m "chore: add Vitest test infrastructure"
```

---

### Task 7: Prisma client singleton

**Files:**
- Create: `src/lib/db/client.ts`

- [ ] **Step 1: Write `src/lib/db/client.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

The singleton pattern prevents Next.js hot reload from creating multiple Prisma connections in development.

- [ ] **Step 2: Commit**

```bash
git add src/lib/db/
git commit -m "feat: add Prisma client singleton"
```

---

### Task 8: NextAuth configuration

**Files:**
- Create: `src/types/next-auth.d.ts`
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Create `src/types/next-auth.d.ts`**

Extends Session and JWT with `role` and `primaryCourtId`.

```typescript
import type { DefaultSession } from 'next-auth'
import type { Role } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
      primaryCourtId: string | null
    } & DefaultSession['user']
  }

  interface User {
    role: Role
    primaryCourtId: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: Role
    primaryCourtId: string | null
  }
}
```

- [ ] **Step 2: Create `src/lib/auth.ts`**

```typescript
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/client'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.isActive) return null

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          primaryCourtId: user.primaryCourtId,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.primaryCourtId = user.primaryCourtId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
        session.user.role = token.role
        session.user.primaryCourtId = token.primaryCourtId
      }
      return session
    },
  },
}
```

- [ ] **Step 3: Create `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

- [ ] **Step 4: Commit**

```bash
git add src/types/ src/lib/auth.ts src/app/api/
git commit -m "feat: add NextAuth with credentials provider, JWT session, and role types"
```

---

### Task 9: Auth helpers + tests

**Files:**
- Create: `src/lib/auth-helpers.ts`
- Create: `tests/auth-helpers.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `tests/auth-helpers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { hasRole, isGuard, isManager } from '@/lib/auth-helpers'
import type { Session } from 'next-auth'
import { Role } from '@prisma/client'

const makeSession = (role: Role): Session => ({
  user: { id: 'user-1', name: 'Test', email: 'test@test.com', role, primaryCourtId: null },
  expires: new Date(Date.now() + 86400_000).toISOString(),
})

describe('hasRole', () => {
  it('returns true when session role matches', () => {
    expect(hasRole(makeSession(Role.GUARD), Role.GUARD)).toBe(true)
    expect(hasRole(makeSession(Role.MANAGER), Role.MANAGER)).toBe(true)
  })

  it('returns false when roles do not match', () => {
    expect(hasRole(makeSession(Role.GUARD), Role.MANAGER)).toBe(false)
  })

  it('returns false for null session', () => {
    expect(hasRole(null, Role.GUARD)).toBe(false)
  })
})

describe('isGuard', () => {
  it('returns true for GUARD session', () => {
    expect(isGuard(makeSession(Role.GUARD))).toBe(true)
  })

  it('returns false for MANAGER session', () => {
    expect(isGuard(makeSession(Role.MANAGER))).toBe(false)
  })
})

describe('isManager', () => {
  it('returns true for MANAGER session', () => {
    expect(isManager(makeSession(Role.MANAGER))).toBe(true)
  })

  it('returns false for GUARD session', () => {
    expect(isManager(makeSession(Role.GUARD))).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run -- tests/auth-helpers.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/auth-helpers'`

- [ ] **Step 3: Implement `src/lib/auth-helpers.ts`**

```typescript
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import type { Session } from 'next-auth'
import { Role } from '@prisma/client'

export function hasRole(session: Session | null, role: Role): boolean {
  return session?.user?.role === role
}

export function isGuard(session: Session | null): boolean {
  return hasRole(session, Role.GUARD)
}

export function isManager(session: Session | null): boolean {
  return hasRole(session, Role.MANAGER)
}

/**
 * Use in server components / route handlers.
 * Redirects to /login if unauthenticated.
 * Redirects to /login if authenticated but wrong role.
 */
export async function requireSession(requiredRole?: Role): Promise<Session> {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')
  if (requiredRole && session.user.role !== requiredRole) redirect('/login')

  return session
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:run -- tests/auth-helpers.test.ts
```

Expected:
```
✓ hasRole > returns true when session role matches
✓ hasRole > returns false when roles do not match
✓ hasRole > returns false for null session
✓ isGuard > returns true for GUARD session
✓ isGuard > returns false for MANAGER session
✓ isManager > returns true for MANAGER session
✓ isManager > returns false for GUARD session
Test Files  1 passed (1)
Tests       7 passed (7)
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-helpers.ts tests/auth-helpers.test.ts
git commit -m "feat: add auth helper functions with tests (hasRole, isGuard, isManager, requireSession)"
```

---

### Task 10: Middleware (role-based routing) + tests

**Files:**
- Create: `src/lib/middleware-logic.ts`
- Create: `src/middleware.ts`
- Create: `tests/middleware-logic.test.ts`

The testable routing logic is extracted to a pure function so it can be unit-tested without Next.js internals.

- [ ] **Step 1: Write the failing tests**

Create `tests/middleware-logic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resolveRedirect } from '@/lib/middleware-logic'
import { Role } from '@prisma/client'

describe('resolveRedirect', () => {
  it('returns null for /login (public route)', () => {
    expect(resolveRedirect('/login', null)).toBeNull()
  })

  it('returns /login when no session on protected route', () => {
    expect(resolveRedirect('/guard', null)).toBe('/login')
    expect(resolveRedirect('/manager', null)).toBe('/login')
    expect(resolveRedirect('/manager/periods/new', null)).toBe('/login')
  })

  it('allows GUARD on /guard routes', () => {
    expect(resolveRedirect('/guard', Role.GUARD)).toBeNull()
    expect(resolveRedirect('/guard/availability/abc', Role.GUARD)).toBeNull()
  })

  it('redirects GUARD away from /manager routes', () => {
    expect(resolveRedirect('/manager', Role.GUARD)).toBe('/guard')
    expect(resolveRedirect('/manager/admin/courts', Role.GUARD)).toBe('/guard')
  })

  it('allows MANAGER on /manager routes', () => {
    expect(resolveRedirect('/manager', Role.MANAGER)).toBeNull()
    expect(resolveRedirect('/manager/admin/courts', Role.MANAGER)).toBeNull()
  })

  it('redirects MANAGER away from /guard routes', () => {
    expect(resolveRedirect('/guard', Role.MANAGER)).toBe('/manager')
  })

  it('redirects authenticated GUARD from / to /guard', () => {
    expect(resolveRedirect('/', Role.GUARD)).toBe('/guard')
  })

  it('redirects authenticated MANAGER from / to /manager', () => {
    expect(resolveRedirect('/', Role.MANAGER)).toBe('/manager')
  })

  it('redirects unauthenticated user from / to /login', () => {
    expect(resolveRedirect('/', null)).toBe('/login')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run -- tests/middleware-logic.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/middleware-logic'`

- [ ] **Step 3: Implement `src/lib/middleware-logic.ts`**

```typescript
import { Role } from '@prisma/client'

/**
 * Pure function — no Next.js dependency.
 * Returns the URL to redirect to, or null if the request should proceed.
 */
export function resolveRedirect(pathname: string, role: Role | null): string | null {
  // Public routes
  if (pathname.startsWith('/login') || pathname.startsWith('/api/auth')) {
    return null
  }

  // Root redirect
  if (pathname === '/') {
    if (!role) return '/login'
    return role === Role.GUARD ? '/guard' : '/manager'
  }

  // Guard routes
  if (pathname.startsWith('/guard')) {
    if (!role) return '/login'
    if (role !== Role.GUARD) return '/manager'
    return null
  }

  // Manager routes
  if (pathname.startsWith('/manager')) {
    if (!role) return '/login'
    if (role !== Role.MANAGER) return '/guard'
    return null
  }

  // All other paths: no redirect
  return null
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm run test:run -- tests/middleware-logic.test.ts
```

Expected:
```
✓ resolveRedirect > returns null for /login (public route)
✓ resolveRedirect > returns /login when no session on protected route
... (9 tests pass)
Test Files  1 passed (1)
Tests       9 passed (9)
```

- [ ] **Step 5: Implement `src/middleware.ts`**

```typescript
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { Role } from '@prisma/client'
import { resolveRedirect } from '@/lib/middleware-logic'

export default withAuth(
  function middleware(req) {
    const role = (req.nextauth.token?.role ?? null) as Role | null
    const redirect = resolveRedirect(req.nextUrl.pathname, role)

    if (redirect) {
      return NextResponse.redirect(new URL(redirect, req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      // Let the middleware function handle all authorization decisions.
      // Return true here so withAuth always calls our middleware function.
      authorized: () => true,
    },
  }
)

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/middleware-logic.ts src/middleware.ts tests/middleware-logic.test.ts
git commit -m "feat: add role-based routing middleware with unit tests"
```

---

### Task 11: Root layout (RTL + Hebrew)

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Create `src/app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'שמירה בתי משפט',
  description: 'מערכת ניהול סידור עבודה לשוטרי בתי משפט',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create `src/app/page.tsx`** (root redirect)

```typescript
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Role } from '@prisma/client'

export default async function RootPage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')
  if (session.user.role === Role.GUARD) redirect('/guard')
  redirect('/manager')
}
```

- [ ] **Step 3: Create `src/app/(auth)/layout.tsx`**

Centered layout for login. No nav.

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/app/'(auth)'/
git commit -m "feat: add root RTL Hebrew layout and auth layout shell"
```

---

### Task 12: Login page

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/login/LoginForm.tsx`

- [ ] **Step 1: Create `src/app/(auth)/login/LoginForm.tsx`** (client component)

```typescript
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('אימייל או סיסמה שגויים')
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      <div className="space-y-2">
        <Label htmlFor="email">אימייל</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@court.gov.il"
          required
          autoComplete="email"
          dir="ltr"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">סיסמה</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'מתחבר...' : 'התחבר'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Create `src/app/(auth)/login/page.tsx`** (server component)

```typescript
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { LoginForm } from './LoginForm'

export default async function LoginPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect('/')

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">שמירה בתי משפט</CardTitle>
        <p className="text-sm text-muted-foreground">כניסה למערכת</p>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/'(auth)'/login/
git commit -m "feat: add Hebrew RTL login page with credentials form"
```

---

### Task 13: Guard layout + dashboard shell

**Files:**
- Create: `src/app/(guard)/layout.tsx`
- Create: `src/app/(guard)/guard/page.tsx`

- [ ] **Step 1: Create `src/app/(guard)/layout.tsx`**

Mobile-first layout with a sticky header showing the guard's name and primary court.

```typescript
import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@prisma/client'
import { prisma } from '@/lib/db/client'

export default async function GuardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(Role.GUARD)

  const primaryCourt = session.user.primaryCourtId
    ? await prisma.court.findUnique({ where: { id: session.user.primaryCourtId } })
    : null

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="text-xs text-muted-foreground">
            {primaryCourt?.name ?? '—'}
          </div>
          <div>
            <p className="font-semibold text-sm">{session.user.name}</p>
            <p className="text-xs text-muted-foreground text-left">שמירה בתי משפט</p>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/(guard)/guard/page.tsx`**

```typescript
import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@prisma/client'
import { Card, CardContent } from '@/components/ui/card'

export default async function GuardDashboardPage() {
  const session = await requireSession(Role.GUARD)

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">שלום, {session.user.name}</h1>

      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm text-center">
            אין תקופת תזמון פעילה כרגע.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/'(guard)'/
git commit -m "feat: add guard mobile layout and dashboard shell"
```

---

### Task 14: Manager layout + dashboard shell

**Files:**
- Create: `src/app/(manager)/layout.tsx`
- Create: `src/app/(manager)/manager/page.tsx`

- [ ] **Step 1: Create `src/app/(manager)/layout.tsx`**

Desktop layout with a sidebar nav.

```typescript
import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@prisma/client'
import Link from 'next/link'

const navItems = [
  { href: '/manager',              label: 'לוח בקרה' },
  { href: '/manager/admin/guards', label: 'שומרים' },
  { href: '/manager/admin/courts', label: 'בתי משפט' },
  { href: '/manager/admin/config', label: 'הגדרות' },
]

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession(Role.MANAGER)

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-56 border-e bg-card flex flex-col shrink-0">
        <div className="p-4 border-b">
          <p className="font-bold text-sm">שמירה בתי משפט</p>
          <p className="text-xs text-muted-foreground mt-0.5">{session.user.name}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/(manager)/manager/page.tsx`**

```typescript
import { requireSession } from '@/lib/auth-helpers'
import { Role } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ManagerDashboardPage() {
  await requireSession(Role.MANAGER)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">לוח בקרה</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">תקופות פעילות</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">הגשות</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">שומרים</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">—</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">
            אין תקופות תזמון. לחץ &quot;תקופה חדשה&quot; להתחיל.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Run all tests**

```bash
npm run test:run
```

Expected:
```
✓ tests/smoke.test.ts (1)
✓ tests/auth-helpers.test.ts (7)
✓ tests/middleware-logic.test.ts (9)
Test Files  3 passed (3)
Tests       17 passed (17)
```

- [ ] **Step 4: Run the dev server and smoke-test manually**

```bash
npm run dev
```

1. Open `http://localhost:3000` — should redirect to `/login`
2. Log in with `manager@court.gov.il` / `manager123` — should reach `/manager`
3. Log out (or clear cookies), log in with `cohen@court.gov.il` / `guard123` — should reach `/guard`
4. While logged in as guard, try navigating to `/manager` — should redirect to `/guard`

- [ ] **Step 5: Final commit**

```bash
git add src/app/'(manager)'/
git commit -m "feat: add manager desktop layout and dashboard shell"
```

---

## Plan 1 Complete

**What you now have:**
- Next.js 14 project with TypeScript, Tailwind RTL, shadcn/ui base components
- Full 12-entity Prisma schema with DB-level constraints
- Database seeded with courts, guards, and system config
- NextAuth v4 with email/password, JWT session carrying `role` and `primaryCourtId`
- Role-based middleware (GUARD → `/guard`, MANAGER → `/manager`)
- Hebrew RTL root layout
- Login page (Hebrew)
- Guard mobile dashboard shell
- Manager desktop dashboard shell
- 17 passing unit tests

**Next:** [Plan 2 — Admin & Configuration](./2026-04-13-plan-2-admin-config.md)
