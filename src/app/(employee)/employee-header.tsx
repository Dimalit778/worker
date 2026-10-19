'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/ui/logout-button';
import { cn } from '@/lib/utils';
import { UserNav } from './user-nav';

type NavItem = { href: string; label: string; notify: boolean };

type EmployeeHeaderProps = {
  fullName: string;
  courtName: string | null;
  navItems: NavItem[];
  availabilityStatus: 'submitted' | 'pending' | null;
};

function isNavActive(pathname: string, href: string) {
  return href === '/employee' ? pathname === '/employee' : pathname.startsWith(href);
}

function AvailabilityLink({ status, onNavigate }: { status: 'submitted' | 'pending'; onNavigate?: () => void }) {
  return (
    <Link
      href="/employee/availability"
      onClick={onNavigate}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium text-white transition-colors',
        status === 'submitted' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700',
      )}
    >
      {status === 'pending' ? <Bell className="size-4" aria-hidden /> : null}
      הגשת שיבוץ
    </Link>
  );
}

export function EmployeeHeader({ fullName, courtName, navItems, availabilityStatus }: EmployeeHeaderProps) {
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
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
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
    <>
      {/* Desktop: single row */}
      <header className="sticky top-0 z-50 hidden border-b bg-sidebar/95 px-4 py-4 backdrop-blur-md md:block">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            <p className="truncate font-semibold text-foreground">{fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{courtName ?? '—'}</p>
          </div>
          <div className="mx-auto flex flex-wrap items-center justify-center gap-2">
            {availabilityStatus ? <AvailabilityLink status={availabilityStatus} /> : null}
            <UserNav items={navItems} />
          </div>
          <LogoutButton />
        </div>
      </header>

      {/* Mobile: compact bar + side drawer, same pattern as the manager shell */}
      <header className="sticky top-0 z-100 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-3 shadow-sm backdrop-blur md:hidden">
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
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold text-foreground">{fullName}</p>
          {courtName ? <p className="truncate text-xs text-muted-foreground">{courtName}</p> : null}
        </div>
        {availabilityStatus ? <AvailabilityLink status={availabilityStatus} /> : null}
      </header>

      <div className="pointer-events-none fixed inset-0 z-40 md:hidden" role="presentation" aria-hidden={!open}>
        <div
          className={cn(
            'absolute inset-x-0 top-14 bottom-0 transition-opacity duration-300 ease-out',
            open ? 'pointer-events-auto bg-black/45 opacity-100' : 'opacity-0',
          )}
          onClick={close}
        />
        <div
          id={titleId + '-nav'}
          className={cn(
            'absolute top-14 bottom-0 right-0 flex w-64 max-w-[85vw] flex-col border-s border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl',
            'transition-transform duration-300 ease-out will-change-transform',
            open ? 'pointer-events-auto translate-x-0' : 'translate-x-full',
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
          <div className="shrink-0 border-b border-sidebar-border px-4 py-3">
            <p className="truncate text-sm font-semibold">{fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{courtName ?? '—'}</p>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {navItems.map((item) => {
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )}
                >
                  {item.label}
                  {item.notify ? <span className="ms-auto size-2 rounded-full bg-red-500" aria-hidden /> : null}
                </Link>
              );
            })}
          </nav>
          <div className="shrink-0 border-t border-sidebar-border p-2">
            <LogoutButton className="w-full justify-start" />
          </div>
        </div>
      </div>
    </>
  );
}
