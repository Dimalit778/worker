'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  PenLine,
  Scale,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';

export type ManagerNavItem = { href: string; label: string };

type ManagerAppShellProps = {
  fullName: string;
  courtName: string | null;
  navItems: readonly ManagerNavItem[];
  children: React.ReactNode;
};

const NAV_ICONS: Record<string, LucideIcon> = {
  '/manager': LayoutDashboard,
  '/manager/schedule': CalendarDays,
  '/manager/schedules': ClipboardList,
  '/manager/draft': PenLine,
  '/manager/employees': Users,
  '/manager/settings': Settings,
};

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/manager') return pathname === '/manager';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandHeader({ courtName }: { courtName: string | null }) {
  const title = courtName || 'מערכת שיבוץ';

  return (
    <div className="flex min-h-24 min-w-0 shrink-0 items-center gap-3 border-b border-sidebar-border px-4 py-4">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
        <Scale className="size-6" aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-base font-semibold leading-tight text-sidebar-foreground" title={title}>
          {title}
        </p>
        <p className="mt-1 truncate text-xs font-medium text-muted-foreground">ניהול סידור עבודה</p>
      </div>
    </div>
  );
}

function NavLinks({
  items,
  pathname,
  onNavigate,
  className,
}: {
  items: readonly ManagerNavItem[];
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={cn('flex-1 space-y-1 overflow-y-auto px-3 py-4', className)} aria-label="ניווט מנהל">
      {items.map((item) => {
        const active = isNavActive(pathname, item.href);
        const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => {
              if (onNavigate) queueMicrotask(onNavigate);
            }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex min-h-11 min-w-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/25',
              active
                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <span
              className={cn(
                'absolute inset-y-2 start-0 w-1 rounded-e-full transition-opacity',
                active ? 'bg-sidebar-primary-foreground/70 opacity-100' : 'opacity-0',
              )}
              aria-hidden
            />
            <Icon
              className={cn(
                'size-5 shrink-0 transition-colors',
                active
                  ? 'text-sidebar-primary-foreground'
                  : 'text-muted-foreground group-hover:text-sidebar-accent-foreground',
              )}
              aria-hidden
            />
            <p className="truncate" title={item.label}>
              {item.label}
            </p>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ fullName }: { fullName: string }) {
  const displayName = fullName || 'משתמש';
  const initial = displayName.trim().charAt(0) || 'מ';

  return (
    <div className="shrink-0 border-t border-sidebar-border p-3">
      <div className="mb-3 flex min-w-0 items-center gap-3 rounded-md bg-sidebar-accent/65 px-3 py-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-card text-sm font-semibold text-sidebar-accent-foreground shadow-sm">
          {initial}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold text-sidebar-foreground" title={displayName}>
            {displayName}
          </p>
          <p className="truncate text-xs text-muted-foreground">מנהל מערכת</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-full justify-start gap-2 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => signOut({ callbackUrl: '/login' })}
      >
        <LogOut className="size-4" aria-hidden />
        יציאה
      </Button>
    </div>
  );
}

function SidebarContent({
  fullName,
  courtName,
  navItems,
  pathname,
  onNavigate,
}: {
  fullName: string;
  courtName: string | null;
  navItems: readonly ManagerNavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <BrandHeader courtName={courtName} />
      <NavLinks items={navItems} pathname={pathname} onNavigate={onNavigate} />
      <SidebarFooter fullName={fullName} />
    </>
  );
}

export function ManagerAppShell({ fullName, courtName, navItems, children }: ManagerAppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const titleId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col overflow-hidden border-s border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm md:flex">
        <SidebarContent fullName={fullName} courtName={courtName} navItems={navItems} pathname={pathname} />
      </aside>

      <div className="fixed inset-x-0 top-0 z-100 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/95 px-3 shadow-sm backdrop-blur supports-backdrop-filter:bg-card/80 md:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-expanded={open}
          aria-controls={titleId + '-nav'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          <span className="sr-only">{open ? 'סגור תפריט' : 'פתח תפריט'}</span>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Scale className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="truncate text-sm font-semibold text-foreground" title={courtName ?? fullName}>
              {courtName ?? fullName}
            </p>
            {courtName ? (
              <p className="truncate text-xs text-muted-foreground" title={fullName}>
                {fullName}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-0 z-40 md:hidden" role="presentation" aria-hidden={!open}>
        <div
          className={cn(
            'absolute inset-x-0 top-14 bottom-0 z-40 transition-opacity duration-300 ease-out',
            open ? 'pointer-events-auto bg-black/45 opacity-100' : 'pointer-events-none opacity-0',
          )}
          aria-hidden={!open}
          onClick={close}
        />
        <div
          id={titleId + '-nav'}
          className={cn(
            'absolute top-14 bottom-0 right-0 z-50 flex w-64 max-w-[85vw] flex-col border-s border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl',
            'transition-transform duration-300 ease-out will-change-transform',
            open ? 'pointer-events-auto translate-x-0' : 'pointer-events-none translate-x-full',
          )}
          role="dialog"
          aria-modal={open}
          aria-hidden={!open}
          aria-labelledby={titleId}
          {...(!open ? { inert: true } : {})}
        >
          <h2 id={titleId} className="sr-only">
            ניווט
          </h2>
          <SidebarContent
            fullName={fullName}
            courtName={courtName}
            navItems={navItems}
            pathname={pathname}
            onNavigate={close}
          />
        </div>
      </div>

      <main className="min-w-0 flex-1 overflow-auto pt-14 md:pt-0">
        <div className="min-h-full p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
