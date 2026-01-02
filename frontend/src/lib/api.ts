import type { ApiResponse, PaginatedResponse, DashboardStats, MenuItem, MenuCategory, Order, ChatSession, ChatMessage, Review, Reservation } from '@/types'

// Analytics types
export interface AnalyticsData {
  period: string
  metrics: {
    revenue: number
    orders: number
    avgOrderValue: number
    customers: number
  }
  previousPeriod: {
    revenue: number
    orders: number
    avgOrderValue: number
    customers: number
  }
  revenueChart: { date: string; current: number; previous: number }[]
  peakHours: { hour: number; day: string; orders: number }[]
  reviewStats: {
    total: number
    averageRating: number
    sentimentBreakdown: { positive: number; neutral: number; negative: number }
    responseRate: number
  }
  topItems: { name: string; orders: number; revenue: number }[]
  aiStats: {
    totalRequests: number
    tokensUsed: number
    costSaved: number
    reviewsResponded: number
    menuItemsEnhanced: number
    chatMessagesHandled: number
  }
}

// QR Ordering types
export interface QRMenuData {
  tenantId: string
  businessName: string
  locationName: string
  logoUrl?: string
  categories: {
    id: string
    name: string
    items: {
      id: string
      name: string
      description: string
      price: number
      imageUrl?: string
      allergens?: string[]
      isAvailable: boolean
    }[]
  }[]
}

export interface QROrderRequest {
  locationId: string
  tableNumber?: string
  customerName?: string
  customerPhone?: string
  items: { menuItemId: string; quantity: number; notes?: string }[]
  specialInstructions?: string
  paymentMethod: 'pay_at_counter' | 'card' | 'cash'
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

class ApiClient {
  private token: string | null = null

  setToken(token: string | null) {
    this.token = token
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      // CSRF protection: Required header for state-changing requests
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers,
    }

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request<ApiResponse<{ token: string; user: any; tenant: any }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async register(data: {
    email: string
    password: string
    firstName: string
    lastName: string
    businessName: string
    businessType: string
  }) {
    return this.request<ApiResponse<{ token: string; user: any; tenant: any }>>('/onboard', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getCurrentUser() {
    return this.request<ApiResponse<{ user: any; tenant: any }>>('/auth/me')
  }

  // Dashboard
  async getDashboardStats() {
    return this.request<ApiResponse<DashboardStats>>('/dashboard/stats')
  }

  async getRevenueChart(days: number = 7) {
    return this.request<ApiResponse<{ date: string; revenue: number; orders: number }[]>>(
      `/dashboard/revenue?days=${days}`
    )
  }

  // Menu endpoints
  async getMenuCategories() {
    return this.request<ApiResponse<MenuCategory[]>>('/menu/categories')
  }

  async getMenuItems(categoryId?: string) {
    const query = categoryId ? `?categoryId=${categoryId}` : ''
    return this.request<ApiResponse<MenuItem[]>>(`/menu/items${query}`)
  }

  async createMenuItem(data: Partial<MenuItem>) {
    return this.request<ApiResponse<MenuItem>>('/menu/items', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateMenuItem(id: string, data: Partial<MenuItem>) {
    return this.request<ApiResponse<MenuItem>>(`/menu/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteMenuItem(id: string) {
    return this.request<ApiResponse<void>>(`/menu/items/${id}`, {
      method: 'DELETE',
    })
  }

  async enhanceMenuItem(id: string, options?: { style?: string; detectAllergens?: boolean }) {
    return this.request<ApiResponse<MenuItem>>(`/menu/${id}/ai-enhance`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    })
  }

  // Orders
  async getOrders(params?: { status?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<PaginatedResponse<Order>>(`/orders?${query}`)
  }

  async getOrder(id: string) {
    return this.request<ApiResponse<Order>>(`/orders/${id}`)
  }

  async updateOrderStatus(id: string, status: string) {
    return this.request<ApiResponse<Order>>(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  // Chat
  async getChatSessions(params?: { status?: string; page?: number }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<PaginatedResponse<ChatSession>>(`/chat/sessions?${query}`)
  }

  async getChatMessages(sessionId: string) {
    return this.request<ApiResponse<ChatMessage[]>>(`/chat/sessions/${sessionId}/messages`)
  }

  async sendChatMessage(sessionId: string, message: string) {
    return this.request<ApiResponse<{ response: string }>>('/chat', {
      method: 'POST',
      body: JSON.stringify({ sessionId, message }),
    })
  }

  // Reviews
  async getReviews(params?: { sentiment?: string; page?: number }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<PaginatedResponse<Review>>(`/reviews?${query}`)
  }

  async generateReviewResponse(reviewId: string, options?: { tone?: string; maxLength?: number }) {
    return this.request<ApiResponse<{ response: string }>>(`/reviews/${reviewId}/ai-respond`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    })
  }

  async getReviewInsights() {
    return this.request<ApiResponse<any>>('/reviews/insights')
  }

  // Reservations
  async getReservations(params?: { date?: string; status?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<PaginatedResponse<Reservation>>(`/reservations?${query}`)
  }

  async createReservation(data: Partial<Reservation>) {
    return this.request<ApiResponse<Reservation>>('/reservations', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateReservationStatus(id: string, status: string) {
    return this.request<ApiResponse<Reservation>>(`/reservations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  // Recommendations
  async getRecommendations(params?: { context?: string; limit?: number }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<ApiResponse<any>>(`/recommendations?${query}`)
  }

  // Billing
  async getBillingInfo() {
    return this.request<ApiResponse<{
      tenantId: string
      tier: string
      tierDisplayName: string
      priceMonthly: number
      status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'suspended'
      stripeCustomerId: string | null
      stripeSubscriptionId: string | null
      currentPeriodEnd: string | null
      cancelAtPeriodEnd: boolean
      usage: {
        apiCallsThisMonth: number
        apiCallsLimit: number
        percentUsed: number
      }
    }>>('/billing')
  }

  async getPricingTiers() {
    return this.request<ApiResponse<Array<{
      name: string
      displayName: string
      priceMonthly: number
      priceYearly: number
      features: Record<string, boolean>
      limits: {
        locations: number
        users: number
        menuItems: number
        apiCalls: number
      }
    }>>>('/billing/tiers')
  }

  async createCheckoutSession(tier: string, successUrl: string, cancelUrl: string, interval?: 'monthly' | 'yearly') {
    return this.request<ApiResponse<{ sessionId: string; url: string }>>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier, successUrl, cancelUrl, interval }),
    })
  }

  async createPortalSession(returnUrl: string) {
    return this.request<ApiResponse<{ url: string }>>('/billing/portal', {
      method: 'POST',
      body: JSON.stringify({ returnUrl }),
    })
  }

  // Onboarding
  async checkSlugAvailability(slug: string) {
    return this.request<ApiResponse<{ available: boolean; suggestions?: string[] }>>(`/onboarding/check-slug?slug=${encodeURIComponent(slug)}`)
  }

  async completeOnboarding(data: {
    businessName: string
    slug: string
    contactEmail: string
    contactPhone?: string
    businessType: string
    pricingTier: 'starter' | 'professional' | 'enterprise'
    billingInterval: 'monthly' | 'yearly'
    firstLocation?: {
      name: string
      address: string
      city: string
      state: string
      postalCode: string
      country: string
    }
  }) {
    return this.request<ApiResponse<{ success: boolean }>>('/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getOnboardingStatus() {
    return this.request<ApiResponse<{
      isComplete: boolean
      completedSteps: string[]
      currentStep: string
    }>>('/onboarding/status')
  }

  // Integrations - Google Business
  async getGoogleBusinessStatus() {
    return this.request<ApiResponse<{
      connected: boolean
      profile: {
        id: string
        name: string
        address: string
        rating: number
        totalReviews: number
        placeId: string
        lastSyncAt: string | null
      } | null
    }>>('/integrations/google-business/status')
  }

  async connectGoogleBusiness(businessName: string, address?: string) {
    return this.request<ApiResponse<{
      success: boolean
      profile: {
        id: string
        name: string
        address: string
        rating: number
        totalReviews: number
        placeId: string
        connected: boolean
        lastSyncAt: string | null
      }
    }>>('/integrations/google-business/connect', {
      method: 'POST',
      body: JSON.stringify({ businessName, address }),
    })
  }

  async disconnectGoogleBusiness() {
    return this.request<ApiResponse<{ disconnected: boolean }>>('/integrations/google-business/disconnect', {
      method: 'POST',
    })
  }

  async syncGoogleReviews(locationId?: string) {
    return this.request<ApiResponse<{
      success: boolean
      reviewsImported: number
      newReviews: number
      errors: string[]
    }>>('/integrations/google-business/sync', {
      method: 'POST',
      body: JSON.stringify({ locationId }),
    })
  }

  async searchGoogleBusinessProfiles(query: string) {
    return this.request<ApiResponse<Array<{
      placeId: string
      name: string
      address: string
    }>>>(`/integrations/google-business/search?q=${encodeURIComponent(query)}`)
  }

  // Notifications
  async getNotificationPreferences() {
    return this.request<ApiResponse<{
      reviewAlerts: boolean
      orderNotifications: boolean
      weeklyDigest: boolean
      marketingEmails: boolean
    }>>('/notifications/preferences')
  }

  async updateNotificationPreferences(preferences: {
    reviewAlerts?: boolean
    orderNotifications?: boolean
    weeklyDigest?: boolean
    marketingEmails?: boolean
  }) {
    return this.request<ApiResponse<{ updated: boolean }>>('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(preferences),
    })
  }

  async sendTestEmail(type: 'welcome' | 'review' | 'digest') {
    return this.request<ApiResponse<{ success: boolean; messageId?: string }>>('/notifications/test', {
      method: 'POST',
      body: JSON.stringify({ type }),
    })
  }

  // Analytics
  async getAnalytics(period: '7d' | '30d' | '90d' | '1y' = '30d') {
    return this.request<ApiResponse<AnalyticsData>>(`/analytics?period=${period}`)
  }

  async getAnalyticsInsights() {
    return this.request<ApiResponse<{
      insights: { type: string; title: string; description: string; impact: 'high' | 'medium' | 'low' }[]
    }>>('/analytics/insights')
  }

  // AI Services
  async generateAIResponse(type: 'review' | 'chat' | 'menu', input: string, options?: {
    tone?: string
    style?: string
    context?: Record<string, any>
  }) {
    return this.request<ApiResponse<{ response: string; tokensUsed: number }>>('/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ type, input, ...options }),
    })
  }

  async analyzesentiment(text: string) {
    return this.request<ApiResponse<{
      sentiment: 'positive' | 'neutral' | 'negative'
      score: number
      keywords: string[]
    }>>('/ai/sentiment', {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
  }

  async bulkEnhanceMenu(itemIds: string[], style: string) {
    return this.request<ApiResponse<{
      enhanced: { id: string; description: string }[]
      failed: string[]
    }>>('/ai/menu/bulk-enhance', {
      method: 'POST',
      body: JSON.stringify({ itemIds, style }),
    })
  }

  async detectAllergens(description: string, ingredients?: string[]) {
    return this.request<ApiResponse<{
      allergens: string[]
      confidence: number
    }>>('/ai/menu/allergens', {
      method: 'POST',
      body: JSON.stringify({ description, ingredients }),
    })
  }

  async suggestPrice(itemName: string, description: string, category: string) {
    return this.request<ApiResponse<{
      suggestedPrice: number
      priceRange: { low: number; high: number }
      rationale: string
    }>>('/ai/menu/suggest-price', {
      method: 'POST',
      body: JSON.stringify({ itemName, description, category }),
    })
  }

  // QR Code Ordering (Public endpoints)
  async getQRMenu(tenantSlug: string, locationId?: string) {
    const query = locationId ? `?locationId=${locationId}` : ''
    return this.request<ApiResponse<QRMenuData>>(`/public/menu/${tenantSlug}${query}`)
  }

  async submitQROrder(tenantSlug: string, order: QROrderRequest) {
    return this.request<ApiResponse<{
      orderId: string
      orderNumber: string
      estimatedTime: number
      total: number
    }>>(`/public/order/${tenantSlug}`, {
      method: 'POST',
      body: JSON.stringify(order),
    })
  }

  async getQROrderStatus(tenantSlug: string, orderId: string) {
    return this.request<ApiResponse<{
      orderId: string
      orderNumber: string
      status: string
      estimatedTime: number
      items: { name: string; quantity: number; status: string }[]
    }>>(`/public/order/${tenantSlug}/${orderId}`)
  }

  // QR Code Generation
  async generateQRCode(locationId: string, options?: { tableNumber?: string; format?: 'svg' | 'png' }) {
    return this.request<ApiResponse<{
      qrCodeUrl: string
      orderUrl: string
    }>>('/locations/qr-code', {
      method: 'POST',
      body: JSON.stringify({ locationId, ...options }),
    })
  }

  // Locations
  async getLocations() {
    return this.request<ApiResponse<Array<{
      id: string
      name: string
      address: string
      city: string
      state: string
      isActive: boolean
    }>>>('/locations')
  }

  async createLocation(data: {
    name: string
    address: string
    city: string
    state: string
    postalCode: string
    country?: string
    phone?: string
  }) {
    return this.request<ApiResponse<{ id: string }>>('/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

export const api = new ApiClient()
