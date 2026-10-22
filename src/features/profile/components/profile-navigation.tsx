'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck, Inbox, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { href: '/employee/profile', label: 'פרופיל', icon: UserRound },
  { href: '/employee/submissions', label: 'ההגשות שלי', icon: ClipboardCheck },
  { href: '/employee/requests', label: 'הבקשות שלי', icon: Inbox },
];

export function ProfileNavigation({ incomingTransfers }: { incomingTransfers: number }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  if (!items.some(({ href }) => isActive(href))) return null;

  return (
    <nav
      aria-label="האזור האישי"
      dir="rtl"
      className="mx-auto mb-6 grid max-w-4xl grid-cols-3 gap-1 rounded-xl bg-muted p-1"
    >
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? 'page' : undefined}
          className={cn(
            'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg! px-2 py-2 text-xs font-medium shadow-none! transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            isActive(href)
              ? 'bg-ring/25 text-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          <span className="relative">
            <Icon className="size-4" aria-hidden />
            {href === '/employee/requests' && incomingTransfers > 0 ? (
              <span
                className="absolute -top-2 start-3 rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
                aria-label={`${incomingTransfers} בקשות להעברה`}
              >
                {incomingTransfers}
              </span>
            ) : null}
          </span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
