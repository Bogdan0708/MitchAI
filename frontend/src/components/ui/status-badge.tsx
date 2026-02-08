import * as React from 'react'
import { cn } from '@/lib/utils'
import { 
  Clock, 
  ChefHat, 
  CheckCircle, 
  XCircle, 
  Truck,
  AlertCircle,
  Pause,
  RefreshCw
} from 'lucide-react'

type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'preparing' 
  | 'ready' 
  | 'delivered' 
  | 'completed' 
  | 'cancelled' 
  | 'refunded'
  | 'on-hold'

type AvailabilityStatus = 
  | 'available' 
  | 'unavailable' 
  | 'low-stock' 
  | 'out-of-stock'

type GenericStatus = 
  | 'active' 
  | 'inactive' 
  | 'pending' 
  | 'error' 
  | 'success' 
  | 'warning'

type StatusType = OrderStatus | AvailabilityStatus | GenericStatus

interface StatusConfig {
  label: string
  icon: React.ComponentType<{ className?: string }>
  className: string
}

const orderStatusConfig: Record<OrderStatus, StatusConfig> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  confirmed: {
    label: 'Confirmed',
    icon: CheckCircle,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  preparing: {
    label: 'Preparing',
    icon: ChefHat,
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },
  ready: {
    label: 'Ready',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  delivered: {
    label: 'Delivered',
    icon: Truck,
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  refunded: {
    label: 'Refunded',
    icon: RefreshCw,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
  },
  'on-hold': {
    label: 'On Hold',
    icon: Pause,
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  },
}

const availabilityStatusConfig: Record<AvailabilityStatus, StatusConfig> = {
  available: {
    label: 'Available',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  unavailable: {
    label: 'Unavailable',
    icon: XCircle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  'low-stock': {
    label: 'Low Stock',
    icon: AlertCircle,
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  'out-of-stock': {
    label: 'Out of Stock',
    icon: XCircle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
}

const genericStatusConfig: Record<GenericStatus, StatusConfig> = {
  active: {
    label: 'Active',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  inactive: {
    label: 'Inactive',
    icon: XCircle,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  error: {
    label: 'Error',
    icon: XCircle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  success: {
    label: 'Success',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  warning: {
    label: 'Warning',
    icon: AlertCircle,
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
}

interface StatusBadgeProps {
  status: StatusType
  type?: 'order' | 'availability' | 'generic'
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  pulse?: boolean
}

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
}

const iconSizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

export function StatusBadge({
  status,
  type = 'generic',
  showIcon = true,
  size = 'sm',
  className,
  pulse = false,
}: StatusBadgeProps) {
  let config: StatusConfig | undefined

  if (type === 'order') {
    config = orderStatusConfig[status as OrderStatus]
  } else if (type === 'availability') {
    config = availabilityStatusConfig[status as AvailabilityStatus]
  } else {
    config = genericStatusConfig[status as GenericStatus]
  }

  if (!config) {
    config = {
      label: status,
      icon: AlertCircle,
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
    }
  }

  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        sizeClasses[size],
        config.className,
        pulse && 'animate-pulse',
        className
      )}
    >
      {showIcon && <Icon className={iconSizeClasses[size]} />}
      {config.label}
    </span>
  )
}

// Convenience exports for specific use cases
export function OrderStatusBadge(props: Omit<StatusBadgeProps, 'type'> & { status: OrderStatus }) {
  return <StatusBadge {...props} type="order" />
}

export function AvailabilityBadge(props: Omit<StatusBadgeProps, 'type'> & { status: AvailabilityStatus }) {
  return <StatusBadge {...props} type="availability" />
}
