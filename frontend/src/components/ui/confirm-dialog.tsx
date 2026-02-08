'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { AlertTriangle, Trash2, Info, CheckCircle, XCircle } from 'lucide-react'

type DialogVariant = 'danger' | 'warning' | 'info' | 'success'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  variant?: DialogVariant
  loading?: boolean
  children?: React.ReactNode
}

const variantConfig: Record<DialogVariant, { icon: React.ComponentType<{ className?: string }>; iconClass: string; buttonVariant: 'destructive' | 'default' }> = {
  danger: {
    icon: Trash2,
    iconClass: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
    buttonVariant: 'destructive',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
    buttonVariant: 'default',
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
    buttonVariant: 'default',
  },
  success: {
    icon: CheckCircle,
    iconClass: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
    buttonVariant: 'default',
  },
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  variant = 'danger',
  loading = false,
  children,
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = React.useState(false)
  const config = variantConfig[variant]
  const Icon = config.icon

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setIsLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !isLoading && !loading && onOpenChange(false)}
      />
      
      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
        <div className="bg-background border border-border rounded-xl shadow-2xl p-6">
          <div className="flex items-start gap-4">
            <div className={cn('p-3 rounded-full', config.iconClass)}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              {description && (
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              )}
              {children && <div className="mt-4">{children}</div>}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading || loading}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={config.buttonVariant}
              onClick={handleConfirm}
              disabled={isLoading || loading}
            >
              {(isLoading || loading) ? 'Loading...' : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook for easy usage
export function useConfirmDialog() {
  const [state, setState] = React.useState<{
    open: boolean
    props: Omit<ConfirmDialogProps, 'open' | 'onOpenChange'>
  }>({
    open: false,
    props: {
      title: '',
      onConfirm: () => {},
    },
  })

  const confirm = React.useCallback(
    (props: Omit<ConfirmDialogProps, 'open' | 'onOpenChange'>) => {
      return new Promise<boolean>((resolve) => {
        setState({
          open: true,
          props: {
            ...props,
            onConfirm: async () => {
              await props.onConfirm()
              resolve(true)
            },
          },
        })
      })
    },
    []
  )

  const close = React.useCallback(() => {
    setState((s) => ({ ...s, open: false }))
  }, [])

  const Dialog = React.useCallback(
    () => (
      <ConfirmDialog
        {...state.props}
        open={state.open}
        onOpenChange={(open) => setState((s) => ({ ...s, open }))}
      />
    ),
    [state]
  )

  return { confirm, close, Dialog }
}
