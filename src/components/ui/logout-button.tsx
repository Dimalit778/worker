'use client';

import { signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function LogoutButton({ className }: { className?: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive', className)}
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      <LogOut className="size-4" aria-hidden />
      יציאה
    </Button>
  );
}
