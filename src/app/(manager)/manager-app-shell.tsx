'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { LogoutButton } from '@/components/ui/logout-button';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ManagerNavItem = { href: string; label: string };

type ManagerAppShellProps = {
  fullName: string;
  courtName: string | null;
  navItems: readonly ManagerNavItem[];
  children: React.ReactNode;
};

function NavLinks({
  items,
  onNavigate,
  className,
}: {
  items: readonly ManagerNavItem[];
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={cn('flex-1 p-2 space-y-1', className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => {
            // Defer so the browser can process navigation before the drawer closes / becomes inert.
            onNavigate && queueMicrotask(onNavigate);
          }}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function SidebarContent({
  fullName,
  courtName,
  navItems,
  onNavigate,
}: {
  fullName: string;
  courtName: string | null;
  navItems: readonly ManagerNavItem[];
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="p-4 border-b">
        <p className="text-lg font-bold text-primary text-center mb-2">{fullName}</p>
        <p className="text-md text-muted-foreground mt-0.5">{courtName}</p>
      </div>
      <NavLinks items={navItems} onNavigate={onNavigate} />
      <div className="p-2 border-t">
        <LogoutButton className="w-full justify-start" />
      </div>
    </>
  );
}

export function ManagerAppShell({ fullName, courtName, navItems, children }: ManagerAppShellProps) {
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
    <div className="h-screen flex bg-background">
      <aside className="hidden md:flex w-56 border-e bg-card flex-col shrink-0">
        <SidebarContent fullName={fullName} courtName={courtName} navItems={navItems} />
      </aside>

      {/* Mobile top bar + drawer (bar must stay above overlay stack so the menu/close control always receives clicks) */}
      <div className="md:hidden fixed top-0 inset-x-0 z-100 border-b bg-card flex items-center gap-2 px-3 h-12 shrink-0">
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
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground truncate">{courtName ?? fullName}</p>
      </div>

      <div className="md:hidden fixed inset-0 z-40 pointer-events-none" role="presentation" aria-hidden={!open}>
        <div
          className={cn(
            'absolute top-12 left-0 right-0 bottom-0 z-40 transition-opacity duration-300 ease-out',
            open ? 'pointer-events-auto bg-black/50 opacity-100' : 'pointer-events-none opacity-0',
          )}
          aria-hidden={!open}
          onClick={close}
        />
        <div
          id={titleId + '-nav'}
          className={cn(
            'absolute z-50 top-12 bottom-0 right-0 w-[min(16rem,85vw)] max-w-full flex flex-col border-l bg-card shadow-lg',
            'transition-transform duration-300 ease-out will-change-transform',
            open ? 'translate-x-0 pointer-events-auto' : 'translate-x-full pointer-events-none',
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
          <SidebarContent fullName={fullName} courtName={courtName} navItems={navItems} onNavigate={close} />
        </div>
      </div>

      <main className="flex-1 p-4 md:p-6 overflow-auto w-full min-w-0 pt-16 md:pt-6">{children}</main>
    </div>
  );
}
