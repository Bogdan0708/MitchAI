'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  BarChart3,
  Settings,
  MessageSquare,
  Star,
  QrCode,
  Zap,
  FileText,
  Shield,
  Link,
  Sun,
  Moon,
  Monitor,
  Search,
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const navigationItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, keywords: ['home', 'overview'] },
  { href: '/dashboard/menu', label: 'Menu', icon: UtensilsCrossed, keywords: ['food', 'items', 'dishes'] },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingBag, keywords: ['sales', 'transactions'] },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, keywords: ['reports', 'stats', 'data'] },
  { href: '/dashboard/reviews', label: 'Reviews', icon: Star, keywords: ['feedback', 'ratings'] },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageSquare, keywords: ['messages', 'support'] },
  { href: '/dashboard/qr-codes', label: 'QR Codes', icon: QrCode, keywords: ['scan', 'table'] },
  { href: '/dashboard/intelligence', label: 'Intelligence', icon: Zap, keywords: ['ai', 'automation'] },
  { href: '/dashboard/content', label: 'Content', icon: FileText, keywords: ['social', 'posts'] },
  { href: '/dashboard/compliance', label: 'Compliance', icon: Shield, keywords: ['safety', 'haccp'] },
  { href: '/dashboard/integrations', label: 'Integrations', icon: Link, keywords: ['connect', 'sync'] },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, keywords: ['config', 'preferences'] },
]

export function CommandMenu({ open, onOpenChange }: CommandMenuProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open, onOpenChange])

  const runCommand = React.useCallback((command: () => void) => {
    onOpenChange(false)
    command()
  }, [onOpenChange])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Command Dialog */}
      <div className="fixed left-1/2 top-1/4 -translate-x-1/2 w-full max-w-lg">
        <Command
          className="rounded-xl border border-border bg-popover shadow-2xl overflow-hidden"
          loop
        >
          <div className="flex items-center border-b border-border px-3">
            <Search className="h-4 w-4 text-muted-foreground mr-2" />
            <Command.Input
              placeholder="Type a command or search..."
              className="flex h-12 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
          
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group heading="Navigation" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {navigationItems.map((item) => (
                <Command.Item
                  key={item.href}
                  value={`${item.label} ${item.keywords.join(' ')}`}
                  onSelect={() => runCommand(() => router.push(item.href))}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm',
                    'aria-selected:bg-accent aria-selected:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Separator className="my-2 h-px bg-border" />

            <Command.Group heading="Theme" className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              <Command.Item
                value="light theme"
                onSelect={() => runCommand(() => setTheme('light'))}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm',
                  'aria-selected:bg-accent aria-selected:text-accent-foreground',
                  theme === 'light' && 'text-primary'
                )}
              >
                <Sun className="h-4 w-4" />
                Light Mode
                {theme === 'light' && <span className="ml-auto text-xs">Active</span>}
              </Command.Item>
              <Command.Item
                value="dark theme"
                onSelect={() => runCommand(() => setTheme('dark'))}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm',
                  'aria-selected:bg-accent aria-selected:text-accent-foreground',
                  theme === 'dark' && 'text-primary'
                )}
              >
                <Moon className="h-4 w-4" />
                Dark Mode
                {theme === 'dark' && <span className="ml-auto text-xs">Active</span>}
              </Command.Item>
              <Command.Item
                value="system theme auto"
                onSelect={() => runCommand(() => setTheme('system'))}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm',
                  'aria-selected:bg-accent aria-selected:text-accent-foreground',
                  theme === 'system' && 'text-primary'
                )}
              >
                <Monitor className="h-4 w-4" />
                System Theme
                {theme === 'system' && <span className="ml-auto text-xs">Active</span>}
              </Command.Item>
            </Command.Group>
          </Command.List>

          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>Navigate with ↑↓ • Select with Enter</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">ESC</kbd>
          </div>
        </Command>
      </div>
    </div>
  )
}

// Hook to use command menu anywhere
export function useCommandMenu() {
  const [open, setOpen] = React.useState(false)
  return { open, setOpen, toggle: () => setOpen((o) => !o) }
}
