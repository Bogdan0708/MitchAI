import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { MenuItem, MenuCategory } from '@/types'

// Query keys
export const menuKeys = {
  all: ['menu'] as const,
  items: () => [...menuKeys.all, 'items'] as const,
  item: (id: string) => [...menuKeys.items(), id] as const,
  categories: () => [...menuKeys.all, 'categories'] as const,
}

// Hooks
export function useMenuItems(categoryId?: string) {
  return useQuery({
    queryKey: [...menuKeys.items(), categoryId],
    queryFn: async () => {
      const response = await api.getMenuItems(categoryId)
      return response.data
    },
  })
}

export function useCategories() {
  return useQuery({
    queryKey: menuKeys.categories(),
    queryFn: async () => {
      const response = await api.getMenuCategories()
      return response.data
    },
  })
}

export function useUpdateMenuItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MenuItem> }) => {
      const response = await api.updateMenuItem(id, data)
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: menuKeys.items() })
      queryClient.invalidateQueries({ queryKey: menuKeys.item(variables.id) })
    },
  })
}

export function useCreateMenuItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: Partial<MenuItem>) => {
      const response = await api.createMenuItem(data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.items() })
    },
  })
}

export function useDeleteMenuItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await api.deleteMenuItem(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.items() })
    },
  })
}

export function useEnhanceMenuItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, style }: { id: string; style?: string }) => {
      const response = await api.enhanceMenuItem(id, { style })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: menuKeys.items() })
    },
  })
}
