'use client'

import { Toaster as SonnerToaster } from 'sonner'
import { useTheme } from '@/contexts/theme-context'

export function Toaster() {
  const { resolvedTheme } = useTheme()

  return (
    <SonnerToaster
      theme={resolvedTheme as 'light' | 'dark'}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'bg-background border-border',
          title: 'text-foreground',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted text-muted-foreground',
        },
      }}
    />
  )
}

// Re-export toast for easy imports
export { toast } from 'sonner'
