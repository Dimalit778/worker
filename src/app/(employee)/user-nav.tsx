'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
  notify: boolean;
};

export function UserNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="employee-nav max-w-lg mx-auto flex flex-wrap gap-2 justify-center">
      {items.map((item) => {
        const isActive = item.href === '/employee' ? pathname === '/employee' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`relative rounded-md px-2.5 py-1 text-sm transition-colors ${
              isActive
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {item.label}
            {item.notify && <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500" />}
          </Link>
        );
      })}
    </nav>
  );
}
