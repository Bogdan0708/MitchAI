import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void

  // Command menu
  commandMenuOpen: boolean
  setCommandMenuOpen: (open: boolean) => void
  toggleCommandMenu: () => void

  // Filters (persisted)
  dashboardDateRange: 'today' | '7d' | '30d' | '90d'
  setDashboardDateRange: (range: 'today' | '7d' | '30d' | '90d') => void

  // Order filters
  orderStatusFilter: string | null
  setOrderStatusFilter: (status: string | null) => void

  // Menu filters
  menuCategoryFilter: string | null
  setMenuCategoryFilter: (category: string | null) => void
  menuSearchQuery: string
  setMenuSearchQuery: (query: string) => void

  // Notifications
  unreadNotifications: number
  setUnreadNotifications: (count: number) => void
  incrementNotifications: () => void
  clearNotifications: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // Command menu
      commandMenuOpen: false,
      setCommandMenuOpen: (open) => set({ commandMenuOpen: open }),
      toggleCommandMenu: () => set((state) => ({ commandMenuOpen: !state.commandMenuOpen })),

      // Dashboard filters
      dashboardDateRange: '7d',
      setDashboardDateRange: (range) => set({ dashboardDateRange: range }),

      // Order filters
      orderStatusFilter: null,
      setOrderStatusFilter: (status) => set({ orderStatusFilter: status }),

      // Menu filters
      menuCategoryFilter: null,
      setMenuCategoryFilter: (category) => set({ menuCategoryFilter: category }),
      menuSearchQuery: '',
      setMenuSearchQuery: (query) => set({ menuSearchQuery: query }),

      // Notifications
      unreadNotifications: 0,
      setUnreadNotifications: (count) => set({ unreadNotifications: count }),
      incrementNotifications: () => set((state) => ({ unreadNotifications: state.unreadNotifications + 1 })),
      clearNotifications: () => set({ unreadNotifications: 0 }),
    }),
    {
      name: 'mitch-ui-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        dashboardDateRange: state.dashboardDateRange,
      }),
    }
  )
)
