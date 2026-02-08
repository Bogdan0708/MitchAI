'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Search, X, Loader2 } from 'lucide-react'

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string
  onChange: (value: string) => void
  onSearch?: (value: string) => void
  debounceMs?: number
  loading?: boolean
  showClear?: boolean
  shortcut?: string
}

export function SearchInput({
  value,
  onChange,
  onSearch,
  debounceMs = 300,
  loading = false,
  showClear = true,
  shortcut,
  className,
  placeholder = 'Search...',
  ...props
}: SearchInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [localValue, setLocalValue] = React.useState(value)

  // Sync local value with external value
  React.useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Debounced onChange
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
        onSearch?.(localValue)
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [localValue, debounceMs, onChange, onSearch, value])

  // Keyboard shortcut
  React.useEffect(() => {
    if (!shortcut) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur()
        setLocalValue('')
        onChange('')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [shortcut, onChange])

  const handleClear = () => {
    setLocalValue('')
    onChange('')
    onSearch?.('')
    inputRef.current?.focus()
  }

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-10 w-full rounded-lg border border-input bg-background pl-10 pr-10 text-sm text-foreground',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
        {...props}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {!loading && showClear && localValue && (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 rounded hover:bg-muted"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        {shortcut && !localValue && (
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            {shortcut}
          </kbd>
        )}
      </div>
    </div>
  )
}
