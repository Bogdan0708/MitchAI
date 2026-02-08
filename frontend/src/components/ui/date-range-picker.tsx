'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Calendar, ChevronDown } from 'lucide-react'
import { Button } from './button'

type DateRangePreset = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'this-month' | 'last-month' | 'this-year' | 'custom'

interface DateRange {
  from: Date
  to: Date
}

interface DateRangePickerProps {
  value: DateRangePreset
  onChange: (preset: DateRangePreset, range?: DateRange) => void
  className?: string
  showIcon?: boolean
}

const presets: Array<{ value: DateRangePreset; label: string; getRange: () => DateRange }> = [
  {
    value: 'today',
    label: 'Today',
    getRange: () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const end = new Date()
      end.setHours(23, 59, 59, 999)
      return { from: today, to: end }
    },
  },
  {
    value: 'yesterday',
    label: 'Yesterday',
    getRange: () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(0, 0, 0, 0)
      const end = new Date(yesterday)
      end.setHours(23, 59, 59, 999)
      return { from: yesterday, to: end }
    },
  },
  {
    value: '7d',
    label: 'Last 7 days',
    getRange: () => {
      const from = new Date()
      from.setDate(from.getDate() - 7)
      from.setHours(0, 0, 0, 0)
      const to = new Date()
      to.setHours(23, 59, 59, 999)
      return { from, to }
    },
  },
  {
    value: '30d',
    label: 'Last 30 days',
    getRange: () => {
      const from = new Date()
      from.setDate(from.getDate() - 30)
      from.setHours(0, 0, 0, 0)
      const to = new Date()
      to.setHours(23, 59, 59, 999)
      return { from, to }
    },
  },
  {
    value: '90d',
    label: 'Last 90 days',
    getRange: () => {
      const from = new Date()
      from.setDate(from.getDate() - 90)
      from.setHours(0, 0, 0, 0)
      const to = new Date()
      to.setHours(23, 59, 59, 999)
      return { from, to }
    },
  },
  {
    value: 'this-month',
    label: 'This month',
    getRange: () => {
      const from = new Date()
      from.setDate(1)
      from.setHours(0, 0, 0, 0)
      const to = new Date()
      to.setHours(23, 59, 59, 999)
      return { from, to }
    },
  },
  {
    value: 'last-month',
    label: 'Last month',
    getRange: () => {
      const from = new Date()
      from.setMonth(from.getMonth() - 1)
      from.setDate(1)
      from.setHours(0, 0, 0, 0)
      const to = new Date(from)
      to.setMonth(to.getMonth() + 1)
      to.setDate(0)
      to.setHours(23, 59, 59, 999)
      return { from, to }
    },
  },
  {
    value: 'this-year',
    label: 'This year',
    getRange: () => {
      const from = new Date()
      from.setMonth(0, 1)
      from.setHours(0, 0, 0, 0)
      const to = new Date()
      to.setHours(23, 59, 59, 999)
      return { from, to }
    },
  },
]

export function DateRangePicker({
  value,
  onChange,
  className,
  showIcon = true,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  const selectedPreset = presets.find((p) => p.value === value) || presets[2] // Default to 7d

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const handleSelect = (preset: typeof presets[0]) => {
    onChange(preset.value, preset.getRange())
    setOpen(false)
  }

  return (
    <div ref={menuRef} className={cn('relative', className)}>
      <Button
        variant="outline"
        onClick={() => setOpen(!open)}
        className="justify-between min-w-[150px]"
      >
        <span className="flex items-center gap-2">
          {showIcon && <Calendar className="h-4 w-4 text-muted-foreground" />}
          {selectedPreset.label}
        </span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </Button>

      {open && (
        <div
          className={cn(
            'absolute right-0 top-full mt-1 z-50 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg',
            'animate-in fade-in-0 zoom-in-95'
          )}
        >
          {presets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => handleSelect(preset)}
              className={cn(
                'flex w-full items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
                'hover:bg-accent',
                value === preset.value && 'bg-accent text-accent-foreground font-medium'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Utility function to format date range for display
export function formatDateRange(range: DateRange): string {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: range.from.getFullYear() !== range.to.getFullYear() ? 'numeric' : undefined,
    })
  }

  const from = formatDate(range.from)
  const to = formatDate(range.to)

  if (from === to) return from
  return `${from} - ${to}`
}

// Hook for using date range
export function useDateRange(initialPreset: DateRangePreset = '7d') {
  const [preset, setPreset] = React.useState<DateRangePreset>(initialPreset)
  const [range, setRange] = React.useState<DateRange>(() => {
    const p = presets.find((p) => p.value === initialPreset)
    return p ? p.getRange() : presets[2].getRange()
  })

  const handleChange = (newPreset: DateRangePreset, newRange?: DateRange) => {
    setPreset(newPreset)
    if (newRange) setRange(newRange)
  }

  return {
    preset,
    range,
    setRange: handleChange,
    formatted: formatDateRange(range),
  }
}
