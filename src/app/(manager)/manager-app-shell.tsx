'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
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
  '/manager/schedule/changes': History,
  '/manager/schedules': ClipboardList,
  '/manager/draft': PenLine,
  '/manager/employees': Users,
  '/manager/settings': Settings,
};

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'manager-sidebar-collapsed';

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/manager') return pathname === '/manager';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function BrandHeader({
  courtName,
  collapsed = false,
  onToggleCollapsed,
}: {
  courtName: string | null;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const title = courtName || 'מערכת שיבוץ';
  const toggleLabel = collapsed ? 'הרחב תפריט צד' : 'כווץ תפריט צד';
  //collapsed menu
  if (collapsed && onToggleCollapsed) {
    return (
      <button
        type="button"
        className="grid py-4 min-h-16 w-full shrink-0 grid-cols-3 items-center border-b border-sidebar-border"
        aria-label={toggleLabel}
        title={toggleLabel}
        aria-expanded={false}
        onClick={onToggleCollapsed}
      >
        <span aria-hidden />
        <div className="flex size-10 shrink-0 items-center justify-center justify-self-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          <Scale className="size-6" aria-hidden />
        </div>
        <ChevronLeft className="size-6 justify-self-end" aria-hidden />
      </button>
    );
  }

  return (
    <div
      className={cn('relative flex min-h-16 min-w-0 shrink-0 items-center gap-3 border-b border-sidebar-border p-3')}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 pe-10">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          <Scale className="size-6" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-base font-semibold leading-tight text-sidebar-foreground" title={title}>
            {title}
          </p>
        </div>
      </div>

      {onToggleCollapsed ? (
        <button
          type="button"
          className="absolute inset-e-0.5 top-1/2 inline-flex size-7 shrink-0 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/25"
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
        >
          <ChevronRight className="size-6" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function NavLinks({
  items,
  pathname,
  onNavigate,
  className,
  collapsed = false,
}: {
  items: readonly ManagerNavItem[];
  pathname: string;
  onNavigate?: () => void;
  className?: string;
  collapsed?: boolean;
}) {
  return (
    <nav
      className={cn('flex-1 space-y-1 overflow-y-auto py-4', collapsed ? 'px-2' : 'px-3', className)}
      aria-label="ניווט מנהל"
    >
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
            aria-label={collapsed ? item.label : undefined}
            title={item.label}
            className={cn(
              'group relative flex min-h-11 min-w-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/25',
              collapsed && 'justify-center gap-0 px-0',
              active
                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <span
              className={cn(
                'absolute inset-y-2 inset-s-0 w-1 rounded-e-full transition-opacity',
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
            {!collapsed ? <p className="truncate">{item.label}</p> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ fullName, collapsed = false }: { fullName: string; collapsed?: boolean }) {
  const displayName = fullName || 'משתמש';
  const initial = displayName.trim().charAt(0) || 'מ';

  return (
    <div className={cn('shrink-0 border-t border-sidebar-border p-3', collapsed && 'px-2')}>
      <div
        className={cn(
          'mb-3 flex min-w-0 items-center gap-3 rounded-md bg-sidebar-accent/65 px-3 py-2.5',
          collapsed && 'justify-center px-2',
        )}
        title={collapsed ? displayName : undefined}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-card text-sm font-semibold text-sidebar-accent-foreground shadow-sm">
          {initial}
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="truncate text-sm font-semibold text-sidebar-foreground" title={displayName}>
              {displayName}
            </p>
            <p className="truncate text-xs text-muted-foreground">מנהל מערכת</p>
          </div>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-9 w-full gap-2 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive',
          collapsed ? 'justify-center px-0' : 'justify-start',
        )}
        onClick={() => signOut({ callbackUrl: '/login' })}
        title="יציאה"
        aria-label="יציאה"
      >
        <LogOut className="size-4" aria-hidden />
        {!collapsed ? 'יציאה' : null}
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
  collapsed = false,
  onToggleCollapsed,
}: {
  fullName: string;
  courtName: string | null;
  navItems: readonly ManagerNavItem[];
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  return (
    <>
      <BrandHeader courtName={courtName} collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      <NavLinks items={navItems} pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
      <SidebarFooter fullName={fullName} collapsed={collapsed} />
    </>
  );
}

export function ManagerAppShell({ fullName, courtName, navItems, children }: ManagerAppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [desktopPreferenceLoaded, setDesktopPreferenceLoaded] = useState(false);
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

  useEffect(() => {
    try {
      setDesktopCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true');
    } catch {
      // Keep the default expanded sidebar when browser storage is unavailable.
    } finally {
      setDesktopPreferenceLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!desktopPreferenceLoaded) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(desktopCollapsed));
    } catch {
      // The preference is optional; navigation remains fully functional without storage.
    }
  }, [desktopCollapsed, desktopPreferenceLoaded]);

  return (
    <div className="app-shell flex h-screen">
      <aside
        className={cn(
          'hidden shrink-0 flex-col overflow-hidden border-s border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-[width] duration-200 ease-out md:flex',
          desktopCollapsed ? 'w-20' : 'w-64',
        )}
      >
        <SidebarContent
          fullName={fullName}
          courtName={courtName}
          navItems={navItems}
          pathname={pathname}
          collapsed={desktopCollapsed}
          onToggleCollapsed={() => setDesktopCollapsed((value) => !value)}
        />
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
        <div className="mx-auto min-h-full max-w-[1440px] p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
