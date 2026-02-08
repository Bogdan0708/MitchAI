'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronRight, Check } from 'lucide-react'

interface DropdownMenuProps {
  trigger: React.ReactNode
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom'
  className?: string
}

export function DropdownMenu({
  trigger,
  children,
  align = 'end',
  side = 'bottom',
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const alignmentClasses = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  }

  const sideClasses = {
    top: 'bottom-full mb-1',
    bottom: 'top-full mt-1',
  }

  return (
    <div ref={menuRef} className={cn('relative inline-block', className)}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      
      {open && (
        <div
          className={cn(
            'absolute z-50 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
            alignmentClasses[align],
            sideClasses[side]
          )}
        >
          <DropdownMenuContext.Provider value={{ close: () => setOpen(false) }}>
            {children}
          </DropdownMenuContext.Provider>
        </div>
      )}
    </div>
  )
}

const DropdownMenuContext = React.createContext<{ close: () => void }>({
  close: () => {},
})

interface DropdownMenuItemProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  destructive?: boolean
  className?: string
  icon?: React.ReactNode
  shortcut?: string
}

export function DropdownMenuItem({
  children,
  onClick,
  disabled = false,
  destructive = false,
  className,
  icon,
  shortcut,
}: DropdownMenuItemProps) {
  const { close } = React.useContext(DropdownMenuContext)

  const handleClick = () => {
    if (disabled) return
    onClick?.()
    close()
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
        'focus:bg-accent focus:text-accent-foreground',
        disabled && 'pointer-events-none opacity-50',
        destructive
          ? 'text-destructive hover:bg-destructive/10 focus:bg-destructive/10'
          : 'text-foreground hover:bg-accent',
        className
      )}
    >
      {icon && <span className="w-4 h-4 flex items-center justify-center">{icon}</span>}
      <span className="flex-1 text-left">{children}</span>
      {shortcut && (
        <kbd className="ml-auto text-xs text-muted-foreground">{shortcut}</kbd>
      )}
    </button>
  )
}

export function DropdownMenuSeparator() {
  return <div className="my-1 h-px bg-border" />
}

export function DropdownMenuLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-2 py-1.5 text-xs font-semibold text-muted-foreground', className)}>
      {children}
    </div>
  )
}

interface DropdownMenuCheckboxItemProps extends Omit<DropdownMenuItemProps, 'icon'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function DropdownMenuCheckboxItem({
  children,
  checked,
  onCheckedChange,
  ...props
}: DropdownMenuCheckboxItemProps) {
  return (
    <DropdownMenuItem
      {...props}
      onClick={() => onCheckedChange(!checked)}
      icon={checked ? <Check className="h-4 w-4" /> : <span className="h-4 w-4" />}
    >
      {children}
    </DropdownMenuItem>
  )
}

interface DropdownMenuSubProps {
  trigger: React.ReactNode
  children: React.ReactNode
}

export function DropdownMenuSub({ trigger, children }: DropdownMenuSubProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors',
          'text-foreground hover:bg-accent cursor-default'
        )}
      >
        <span className="flex-1">{trigger}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      
      {open && (
        <div
          className={cn(
            'absolute left-full top-0 ml-1 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg',
            'animate-in fade-in-0 zoom-in-95'
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}
