'use client'

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

export function LogoutButton({ className }: { className?: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => signOut({ callbackUrl: '/login' })}
    >
      יציאה
    </Button>
  )
}
