import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

export interface FormFieldProps {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: FormFieldProps) {
  const id = htmlFor || React.useId()

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      
      {React.isValidElement(children) ? (
        React.cloneElement(children as React.ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>, {
          id,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
        })
      ) : (
        children
      )}
      
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
