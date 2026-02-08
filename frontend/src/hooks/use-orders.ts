import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Order } from '@/types'

export interface OrdersFilter {
  status?: string
  page?: number
  limit?: number
}

// Query keys
export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: OrdersFilter) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
}

// Hooks
export function useOrders(filters: OrdersFilter = {}) {
  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: async () => {
      const response = await api.getOrders(filters)
      return response
    },
  })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: async () => {
      const response = await api.getOrder(id)
      return response.data
    },
    enabled: !!id,
  })
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await api.updateOrderStatus(id, status)
      return response.data
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
    },
  })
}
