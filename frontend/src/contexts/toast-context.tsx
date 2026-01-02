'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { ToastContainer, type ToastProps } from '@/components/ui/toast'

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info'

interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
  action?: React.ReactNode
}

interface ToastContextType {
  toast: (options: ToastOptions) => string
  success: (title: string, description?: string) => string
  error: (title: string, description?: string) => string
  warning: (title: string, description?: string) => string
  info: (title: string, description?: string) => string
  dismiss: (id: string) => void
  dismissAll: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

let toastCounter = 0

const DEFAULT_DURATION = 5000

export function ToastProvider({
  children,
  position = 'bottom-right'
}: {
  children: React.ReactNode
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
}) {
  const [toasts, setToasts] = useState<ToastProps[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  const toast = useCallback((options: ToastOptions): string => {
    const id = `toast-${++toastCounter}`
    const duration = options.duration ?? DEFAULT_DURATION

    const newToast: ToastProps = {
      id,
      title: options.title,
      description: options.description,
      variant: options.variant || 'default',
      action: options.action,
      duration,
    }

    setToasts((prev) => [...prev, newToast])

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        dismiss(id)
      }, duration)
    }

    return id
  }, [dismiss])

  const success = useCallback((title: string, description?: string): string => {
    return toast({ title, description, variant: 'success' })
  }, [toast])

  const error = useCallback((title: string, description?: string): string => {
    return toast({ title, description, variant: 'error', duration: 7000 })
  }, [toast])

  const warning = useCallback((title: string, description?: string): string => {
    return toast({ title, description, variant: 'warning' })
  }, [toast])

  const info = useCallback((title: string, description?: string): string => {
    return toast({ title, description, variant: 'info' })
  }, [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, dismiss, dismissAll }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} position={position} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export { ToastContext }
