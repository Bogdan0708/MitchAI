import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Query keys
export const analyticsKeys = {
  all: ['analytics'] as const,
  dashboard: () => [...analyticsKeys.all, 'dashboard'] as const,
  revenue: (days: number) => [...analyticsKeys.all, 'revenue', days] as const,
  analytics: (period: string) => [...analyticsKeys.all, 'full', period] as const,
  insights: () => [...analyticsKeys.all, 'insights'] as const,
}

// Hooks
export function useDashboardStats() {
  return useQuery({
    queryKey: analyticsKeys.dashboard(),
    queryFn: async () => {
      const response = await api.getDashboardStats()
      return response.data
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}

export function useRevenueChart(days: number = 7) {
  return useQuery({
    queryKey: analyticsKeys.revenue(days),
    queryFn: async () => {
      const response = await api.getRevenueChart(days)
      return response.data
    },
  })
}

export function useAnalytics(period: '7d' | '30d' | '90d' | '1y' = '30d') {
  return useQuery({
    queryKey: analyticsKeys.analytics(period),
    queryFn: async () => {
      const response = await api.getAnalytics(period)
      return response.data
    },
  })
}

export function useAnalyticsInsights() {
  return useQuery({
    queryKey: analyticsKeys.insights(),
    queryFn: async () => {
      const response = await api.getAnalyticsInsights()
      return response.data
    },
    staleTime: 5 * 60 * 1000,
  })
}
