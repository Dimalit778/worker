'use client'

import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GuardSummary } from './types'

type Props = {
  guards: GuardSummary[]
  currentUserId: string | null
  onSelect: (guardId: string) => void
  onRemove: () => void
  onClose: () => void
}

export function GuardPicker({ guards, currentUserId, onSelect, onRemove, onClose }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? guards.filter(g => g.name.includes(query.trim()))
    : guards

  // Auto-focus search input
  useEffect(() => { inputRef.current?.focus() }, [])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      ref={panelRef}
      className="absolute z-50 bg-white border border-border rounded-lg shadow-lg w-44 py-1"
      style={{ top: '100%', right: 0 }}
      dir="rtl"
    >
      {/* Search */}
      <div className="px-2 pb-1 pt-1 border-b border-border">
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="חיפוש..."
          className="w-full text-xs px-2 py-1 border border-border rounded-md outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Guard list */}
      <ul className="max-h-44 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="px-3 py-2 text-xs text-muted-foreground">לא נמצא</li>
        )}
        {filtered.map(g => (
          <li
            key={g.id}
            onClick={() => onSelect(g.id)}
            className={cn(
              'px-3 py-1.5 text-xs cursor-pointer hover:bg-accent',
              g.id === currentUserId && 'font-semibold bg-accent/50'
            )}
          >
            {g.name}
          </li>
        ))}
      </ul>

      {/* Remove option — only if cell is filled */}
      {currentUserId && (
        <div className="border-t border-border mt-1">
          <button
            onClick={onRemove}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            <X className="w-3 h-3" />
            הסר שיבוץ
          </button>
        </div>
      )}
    </div>
  )
}
