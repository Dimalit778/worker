'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Inbox,
  House,
  LayoutDashboard,
  LogOut,
  Menu,
  PenLine,
  Scale,
  Settings,
  Users,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';

export type AppNavItem = {
  href: string;
  label: string;
  badge?: number;
  badgeLabel?: string;
  status?: 'submitted' | 'pending';
};

type AppShellProps = {
  fullName: string;
  courtName: string | null;
  roleLabel: string;
  navItems: readonly AppNavItem[];
  children: React.ReactNode;
};

const NAV_ICONS: Record<string, LucideIcon> = {
  '/employee/home': House,
  '/employee': CalendarDays,
  '/employee/schedules': ClipboardList,
  '/employee/submissions': ClipboardList,
  '/employee/availability': PenLine,
  '/employee/requests': Inbox,
  '/employee/profile': UserRound,
  '/admin': LayoutDashboard,
  '/admin/courts': Building2,
  '/admin/employees': Users,
  '/admin/config': Settings,
  '/admin/profile': UserRound,
  '/manager': LayoutDashboard,
  '/manager/schedule': CalendarDays,
  '/manager/schedules': ClipboardList,
  '/manager/draft': PenLine,
  '/manager/requests': Inbox,
  '/manager/employees': Users,
  '/manager/settings': Settings,
  '/manager/profile': UserRound,
};

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'app-sidebar-collapsed';

function isNavActive(pathname: string, href: string): boolean {
  if (href.split('/').length === 2) return pathname === href;
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
        className="grid min-h-12 w-full shrink-0 grid-cols-3 items-center border-b border-sidebar-border py-2.5"
        aria-label={toggleLabel}
        title={toggleLabel}
        aria-expanded={false}
        onClick={onToggleCollapsed}
      >
        <span aria-hidden />
        <div className="flex size-9 shrink-0 items-center justify-center justify-self-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          <Scale className="size-5" aria-hidden />
        </div>
        <ChevronLeft className="size-5 justify-self-end" aria-hidden />
      </button>
    );
  }

  return (
    <div
      className={cn('relative flex min-h-12 min-w-0 shrink-0 items-center gap-2 border-b border-sidebar-border p-2')}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 pe-8">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
          <Scale className="size-5" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-tight text-sidebar-foreground" title={title}>
            {title}
          </p>
        </div>
      </div>

      {onToggleCollapsed ? (
        <button
          type="button"
          className="absolute inset-e-0.5 top-1/2 inline-flex size-6 shrink-0 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/25"
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
        >
          <ChevronRight className="size-5" aria-hidden />
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
  items: readonly AppNavItem[];
  pathname: string;
  onNavigate?: () => void;
  className?: string;
  collapsed?: boolean;
}) {
  return (
    <nav
      className={cn('flex-1 space-y-0.5 overflow-y-auto py-2', collapsed ? 'px-1.5' : 'px-2', className)}
      aria-label="ניווט ראשי"
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
              'group relative flex min-h-9 min-w-0 items-center gap-2 rounded-sm px-2.5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/25',
              collapsed && 'justify-center gap-0 px-0',
              active
                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon
              className={cn(
                'size-4 shrink-0 transition-colors',
                active
                  ? 'text-sidebar-primary-foreground'
                  : 'text-muted-foreground group-hover:text-sidebar-accent-foreground',
              )}
              aria-hidden
            />
            {!collapsed ? <p className="truncate">{item.label}</p> : null}
            {item.status ? (
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  collapsed ? 'absolute top-1 inset-e-1' : 'ms-auto',
                  item.status === 'submitted' ? 'bg-green-600' : 'bg-red-600',
                )}
              >
                <span className="sr-only">{item.status === 'submitted' ? 'הוגש' : 'ממתין להגשה'}</span>
              </span>
            ) : null}
            {item.badge ? (
              <span
                className={cn(
                  'rounded-full bg-red-600 px-1.5 text-xs font-semibold text-white',
                  collapsed ? 'absolute top-0.5 inset-e-0.5' : 'ms-auto',
                )}
                aria-label={`${item.badge} ${item.badgeLabel ?? 'בקשות דחופות'}`}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ fullName, roleLabel, collapsed = false }: { fullName: string; roleLabel: string; collapsed?: boolean }) {
  const displayName = fullName || 'משתמש';
  const initial = displayName.trim().charAt(0) || 'מ';

  return (
    <div className={cn('shrink-0 border-t border-sidebar-border p-2', collapsed && 'px-1.5')}>
      <div
        className={cn(
          'mb-2 flex min-w-0 items-center gap-2 rounded-md bg-sidebar-accent/65 px-2.5 py-2',
          collapsed && 'justify-center px-1.5',
        )}
        title={collapsed ? displayName : undefined}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-card text-sm font-semibold text-sidebar-accent-foreground shadow-sm">
          {initial}
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="truncate text-sm font-semibold text-sidebar-foreground" title={displayName}>
              {displayName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 w-full gap-2 px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive',
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
  roleLabel,
  courtName,
  navItems,
  pathname,
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: {
  fullName: string;
  roleLabel: string;
  courtName: string | null;
  navItems: readonly AppNavItem[];
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  return (
    <>
      <BrandHeader courtName={courtName} collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      <NavLinks items={navItems} pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
      <SidebarFooter fullName={fullName} roleLabel={roleLabel} collapsed={collapsed} />
    </>
  );
}

export function AppShell({ fullName, courtName, roleLabel, navItems, children }: AppShellProps) {
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
    <div className="app-shell flex min-h-dvh md:h-dvh">
      <aside
        className={cn(
          'hidden shrink-0 flex-col overflow-hidden border-s border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-[width] duration-200 ease-out md:flex',
          desktopCollapsed ? 'w-20' : 'w-64',
        )}
      >
        <SidebarContent
          fullName={fullName}
          roleLabel={roleLabel}
          courtName={courtName}
          navItems={navItems}
          pathname={pathname}
          collapsed={desktopCollapsed}
          onToggleCollapsed={() => setDesktopCollapsed((value) => !value)}
        />
      </aside>

      <div className="fixed inset-x-0 top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/95 px-3 shadow-sm backdrop-blur supports-backdrop-filter:bg-card/80 md:hidden">
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
            roleLabel={roleLabel}
            courtName={courtName}
            navItems={navItems}
            pathname={pathname}
            onNavigate={close}
          />
        </div>
      </div>

      {/* Document scrolling avoids iOS Home Screen latching to an outer scroll area. */}
      <main className="min-w-0 flex-1 pt-14 md:overflow-auto md:pt-0">
        <div className="mx-auto min-h-full max-w-[1440px] p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
