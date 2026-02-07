import type {
  ApiResponse, PaginatedResponse, DashboardStats, MenuItem, MenuCategory, Order, ChatSession, ChatMessage, Review, Reservation,
  // New module types
  ComplianceTemplate, ComplianceCheck, Equipment, TemperatureLog, CorrectiveAction, HACCPPlan,
  AggregatedReview, ReviewResponseTemplate, ReviewInsights, ReviewPlatformConnection,
  ContentCalendarItem, ContentCampaign, SocialAccount, ContentIdea, TrendingTopic,
  BusinessAlert, BusinessInsight, AlertRule, AutomationRule
} from '@/types'

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

  async bulkEnhanceMenu(items: Array<{
    id: string
    name: string
    category?: string
    ingredients?: string[]
    allergens?: string[]
    price?: number
    is_vegetarian?: boolean
    is_vegan?: boolean
    is_gluten_free?: boolean
  }>, style: string) {
    // Uses existing /ai/menu-description/batch endpoint
    return this.request<ApiResponse<{
      results: Array<{ id: string; description: string; success: boolean; error?: string }>
      successful: number
      failed: number
    }>>('/ai/menu-description/batch', {
      method: 'POST',
      body: JSON.stringify({ items, style }),
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

  // ============================================================================
  // COMPLIANCE MODULE (Food Safety)
  // ============================================================================

  // Templates
  async getComplianceTemplates(params?: { category?: string; locationId?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<ApiResponse<ComplianceTemplate[]>>(`/compliance/templates?${query}`)
  }

  async getComplianceTemplate(id: string) {
    return this.request<ApiResponse<ComplianceTemplate>>(`/compliance/templates/${id}`)
  }

  async createComplianceTemplate(data: Partial<ComplianceTemplate>) {
    return this.request<ApiResponse<ComplianceTemplate>>('/compliance/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateComplianceTemplate(id: string, data: Partial<ComplianceTemplate>) {
    return this.request<ApiResponse<ComplianceTemplate>>(`/compliance/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteComplianceTemplate(id: string) {
    return this.request<ApiResponse<void>>(`/compliance/templates/${id}`, {
      method: 'DELETE',
    })
  }

  // Compliance Checks
  async getComplianceChecks(params?: { templateId?: string; locationId?: string; status?: string; startDate?: string; endDate?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<PaginatedResponse<ComplianceCheck>>(`/compliance/checks?${query}`)
  }

  async submitComplianceCheck(data: { templateId: string; locationId: string; responses: Record<string, any>; notes?: string }) {
    return this.request<ApiResponse<ComplianceCheck>>('/compliance/checks', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getComplianceCheckDetails(id: string) {
    return this.request<ApiResponse<ComplianceCheck>>(`/compliance/checks/${id}`)
  }

  // Equipment
  async getEquipment(params?: { locationId?: string; type?: string; status?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<ApiResponse<Equipment[]>>(`/compliance/equipment?${query}`)
  }

  async createEquipment(data: Partial<Equipment>) {
    return this.request<ApiResponse<Equipment>>('/compliance/equipment', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateEquipment(id: string, data: Partial<Equipment>) {
    return this.request<ApiResponse<Equipment>>(`/compliance/equipment/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteEquipment(id: string) {
    return this.request<ApiResponse<void>>(`/compliance/equipment/${id}`, {
      method: 'DELETE',
    })
  }

  // Temperature Logs
  async getTemperatureLogs(params?: { equipmentId?: string; locationId?: string; startDate?: string; endDate?: string; outOfRange?: boolean }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<PaginatedResponse<TemperatureLog>>(`/compliance/temperature-logs?${query}`)
  }

  async logTemperature(data: { equipmentId: string; temperature: number; unit?: 'celsius' | 'fahrenheit'; notes?: string }) {
    return this.request<ApiResponse<TemperatureLog>>('/compliance/temperature-logs', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Corrective Actions
  async getCorrectiveActions(params?: { locationId?: string; status?: string; severity?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<PaginatedResponse<CorrectiveAction>>(`/compliance/corrective-actions?${query}`)
  }

  async createCorrectiveAction(data: Partial<CorrectiveAction>) {
    return this.request<ApiResponse<CorrectiveAction>>('/compliance/corrective-actions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCorrectiveAction(id: string, data: Partial<CorrectiveAction>) {
    return this.request<ApiResponse<CorrectiveAction>>(`/compliance/corrective-actions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async resolveCorrectiveAction(id: string, notes: string) {
    return this.request<ApiResponse<CorrectiveAction>>(`/compliance/corrective-actions/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    })
  }

  // HACCP Plans
  async getHACCPPlans() {
    return this.request<ApiResponse<HACCPPlan[]>>('/compliance/haccp-plans')
  }

  async createHACCPPlan(data: Partial<HACCPPlan>) {
    return this.request<ApiResponse<HACCPPlan>>('/compliance/haccp-plans', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Compliance Dashboard
  async getComplianceDashboard(locationId?: string) {
    const query = locationId ? `?locationId=${locationId}` : ''
    return this.request<ApiResponse<{
      complianceScore: number
      checksToday: number
      checksDue: number
      openActions: number
      criticalAlerts: number
      recentChecks: ComplianceCheck[]
      equipmentAlerts: { equipment: Equipment; issue: string }[]
    }>>(`/compliance/dashboard${query}`)
  }

  // ============================================================================
  // REVIEW MANAGEMENT MODULE (Guest Whisperer)
  // ============================================================================

  // Aggregated Reviews
  async getAggregatedReviews(params?: { platform?: string; sentiment?: string; status?: string; startDate?: string; endDate?: string; page?: number }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<PaginatedResponse<AggregatedReview>>(`/review-management/reviews?${query}`)
  }

  async getAggregatedReview(id: string) {
    return this.request<ApiResponse<AggregatedReview>>(`/review-management/reviews/${id}`)
  }

  async updateReviewStatus(id: string, status: AggregatedReview['status']) {
    return this.request<ApiResponse<AggregatedReview>>(`/review-management/reviews/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  async generateAIReviewResponse(id: string, options?: { tone?: string; templateId?: string; includeOffer?: boolean }) {
    return this.request<ApiResponse<{ response: string; confidence: number }>>(`/review-management/reviews/${id}/generate-response`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    })
  }

  async submitReviewResponse(id: string, response: string, publishToSource?: boolean) {
    return this.request<ApiResponse<AggregatedReview>>(`/review-management/reviews/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response, publishToSource }),
    })
  }

  async bulkUpdateReviews(reviewIds: string[], action: 'mark_read' | 'archive' | 'flag') {
    return this.request<ApiResponse<{ updated: number }>>('/review-management/reviews/bulk', {
      method: 'POST',
      body: JSON.stringify({ reviewIds, action }),
    })
  }

  // Response Templates
  async getResponseTemplates(category?: string) {
    const query = category ? `?category=${category}` : ''
    return this.request<ApiResponse<ReviewResponseTemplate[]>>(`/review-management/templates${query}`)
  }

  async createResponseTemplate(data: Partial<ReviewResponseTemplate>) {
    return this.request<ApiResponse<ReviewResponseTemplate>>('/review-management/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateResponseTemplate(id: string, data: Partial<ReviewResponseTemplate>) {
    return this.request<ApiResponse<ReviewResponseTemplate>>(`/review-management/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteResponseTemplate(id: string) {
    return this.request<ApiResponse<void>>(`/review-management/templates/${id}`, {
      method: 'DELETE',
    })
  }

  // Review Insights
  async getReviewInsightsSummary(period?: 'daily' | 'weekly' | 'monthly') {
    const query = period ? `?period=${period}` : ''
    return this.request<ApiResponse<ReviewInsights>>(`/review-management/insights${query}`)
  }

  async getReviewTrends(params?: { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<ApiResponse<{ date: string; avgRating: number; reviewCount: number; sentiment: { positive: number; neutral: number; negative: number } }[]>>(`/review-management/trends?${query}`)
  }

  async getTopicAnalysis(period?: 'week' | 'month' | 'quarter') {
    const query = period ? `?period=${period}` : ''
    return this.request<ApiResponse<{ topic: string; mentions: number; avgSentiment: number; trend: 'up' | 'down' | 'stable' }[]>>(`/review-management/topics${query}`)
  }

  // Platform Connections
  async getReviewPlatformConnections() {
    return this.request<ApiResponse<ReviewPlatformConnection[]>>('/review-management/platforms')
  }

  async connectReviewPlatform(platform: string, credentials: Record<string, any>) {
    return this.request<ApiResponse<ReviewPlatformConnection>>('/review-management/platforms/connect', {
      method: 'POST',
      body: JSON.stringify({ platform, credentials }),
    })
  }

  async syncReviewPlatform(platform: string) {
    return this.request<ApiResponse<{ synced: number; new: number }>>(`/review-management/platforms/${platform}/sync`, {
      method: 'POST',
    })
  }

  async disconnectReviewPlatform(platform: string) {
    return this.request<ApiResponse<void>>(`/review-management/platforms/${platform}/disconnect`, {
      method: 'POST',
    })
  }

  // ============================================================================
  // CONTENT PLANNER MODULE (Social Media)
  // ============================================================================

  // Content Calendar
  async getContentCalendar(params?: { startDate?: string; endDate?: string; status?: string; platform?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<ApiResponse<ContentCalendarItem[]>>(`/content/calendar?${query}`)
  }

  async getContentItem(id: string) {
    return this.request<ApiResponse<ContentCalendarItem>>(`/content/calendar/${id}`)
  }

  async createContentItem(data: Partial<ContentCalendarItem>) {
    return this.request<ApiResponse<ContentCalendarItem>>('/content/calendar', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateContentItem(id: string, data: Partial<ContentCalendarItem>) {
    return this.request<ApiResponse<ContentCalendarItem>>(`/content/calendar/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteContentItem(id: string) {
    return this.request<ApiResponse<void>>(`/content/calendar/${id}`, {
      method: 'DELETE',
    })
  }

  async scheduleContent(id: string, scheduledAt: string) {
    return this.request<ApiResponse<ContentCalendarItem>>(`/content/calendar/${id}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduledAt }),
    })
  }

  async publishContentNow(id: string) {
    return this.request<ApiResponse<ContentCalendarItem>>(`/content/calendar/${id}/publish`, {
      method: 'POST',
    })
  }

  // AI Content Generation
  async generateCaption(data: { contentType: string; platform: string; topic?: string; tone?: string; menuItem?: string }) {
    return this.request<ApiResponse<{ caption: string; hashtags: string[]; suggestions: string[] }>>('/content/generate/caption', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async generateContentIdeas(data: { count?: number; contentTypes?: string[]; themes?: string[] }) {
    return this.request<ApiResponse<ContentIdea[]>>('/content/generate/ideas', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async generateVideoScript(data: { topic: string; duration: number; style: string; platform: string }) {
    return this.request<ApiResponse<{ script: string; scenes: { timestamp: string; description: string; voiceover: string }[] }>>('/content/generate/script', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Campaigns
  async getCampaigns(status?: string) {
    const query = status ? `?status=${status}` : ''
    return this.request<ApiResponse<ContentCampaign[]>>(`/content/campaigns${query}`)
  }

  async getCampaign(id: string) {
    return this.request<ApiResponse<ContentCampaign & { content: ContentCalendarItem[] }>>(`/content/campaigns/${id}`)
  }

  async createCampaign(data: Partial<ContentCampaign>) {
    return this.request<ApiResponse<ContentCampaign>>('/content/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCampaign(id: string, data: Partial<ContentCampaign>) {
    return this.request<ApiResponse<ContentCampaign>>(`/content/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCampaign(id: string) {
    return this.request<ApiResponse<void>>(`/content/campaigns/${id}`, {
      method: 'DELETE',
    })
  }

  // Social Accounts
  async getSocialAccounts() {
    return this.request<ApiResponse<SocialAccount[]>>('/content/accounts')
  }

  async connectSocialAccount(platform: string, authCode: string) {
    return this.request<ApiResponse<SocialAccount>>('/content/accounts/connect', {
      method: 'POST',
      body: JSON.stringify({ platform, authCode }),
    })
  }

  async disconnectSocialAccount(id: string) {
    return this.request<ApiResponse<void>>(`/content/accounts/${id}/disconnect`, {
      method: 'POST',
    })
  }

  async refreshSocialAccount(id: string) {
    return this.request<ApiResponse<SocialAccount>>(`/content/accounts/${id}/refresh`, {
      method: 'POST',
    })
  }

  // Content Ideas & Trending
  async getContentIdeas(params?: { status?: string; source?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<ApiResponse<ContentIdea[]>>(`/content/ideas?${query}`)
  }

  async saveContentIdea(id: string) {
    return this.request<ApiResponse<ContentIdea>>(`/content/ideas/${id}/save`, {
      method: 'POST',
    })
  }

  async dismissContentIdea(id: string) {
    return this.request<ApiResponse<void>>(`/content/ideas/${id}/dismiss`, {
      method: 'POST',
    })
  }

  async getTrendingTopics(params?: { platform?: string; category?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<ApiResponse<TrendingTopic[]>>(`/content/trending?${query}`)
  }

  // Content Analytics
  async getContentAnalytics(params?: { startDate?: string; endDate?: string; platform?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<ApiResponse<{
      totalPosts: number
      totalEngagement: number
      avgEngagementRate: number
      topPerformingContent: ContentCalendarItem[]
      engagementByPlatform: { platform: string; posts: number; engagement: number }[]
      engagementOverTime: { date: string; engagement: number }[]
    }>>(`/content/analytics?${query}`)
  }

  // ============================================================================
  // BUSINESS INTELLIGENCE MODULE
  // ============================================================================

  // Alerts
  async getAlerts(params?: { severity?: string; alertType?: string; isRead?: boolean; isResolved?: boolean }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<PaginatedResponse<BusinessAlert>>(`/intelligence/alerts?${query}`)
  }

  async markAlertRead(id: string) {
    return this.request<ApiResponse<BusinessAlert>>(`/intelligence/alerts/${id}/read`, {
      method: 'POST',
    })
  }

  async resolveAlert(id: string, notes?: string) {
    return this.request<ApiResponse<BusinessAlert>>(`/intelligence/alerts/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    })
  }

  async markAllAlertsRead() {
    return this.request<ApiResponse<{ updated: number }>>('/intelligence/alerts/mark-all-read', {
      method: 'POST',
    })
  }

  async getAlertStats() {
    return this.request<ApiResponse<{
      unread: number
      critical: number
      warning: number
      byType: { type: string; count: number }[]
    }>>('/intelligence/alerts/stats')
  }

  // Insights
  async getInsights(params?: { category?: string; insightType?: string; isActionable?: boolean }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<ApiResponse<BusinessInsight[]>>(`/intelligence/insights?${query}`)
  }

  async dismissInsight(id: string) {
    return this.request<ApiResponse<void>>(`/intelligence/insights/${id}/dismiss`, {
      method: 'POST',
    })
  }

  async generateInsights() {
    return this.request<ApiResponse<{ generated: number; insights: BusinessInsight[] }>>('/intelligence/insights/generate', {
      method: 'POST',
    })
  }

  // Alert Rules
  async getAlertRules() {
    return this.request<ApiResponse<AlertRule[]>>('/intelligence/alert-rules')
  }

  async createAlertRule(data: Partial<AlertRule>) {
    return this.request<ApiResponse<AlertRule>>('/intelligence/alert-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateAlertRule(id: string, data: Partial<AlertRule>) {
    return this.request<ApiResponse<AlertRule>>(`/intelligence/alert-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteAlertRule(id: string) {
    return this.request<ApiResponse<void>>(`/intelligence/alert-rules/${id}`, {
      method: 'DELETE',
    })
  }

  async toggleAlertRule(id: string, isActive: boolean) {
    return this.request<ApiResponse<AlertRule>>(`/intelligence/alert-rules/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ isActive }),
    })
  }

  // Automation Rules
  async getAutomationRules() {
    return this.request<ApiResponse<AutomationRule[]>>('/intelligence/automations')
  }

  async createAutomationRule(data: Partial<AutomationRule>) {
    return this.request<ApiResponse<AutomationRule>>('/intelligence/automations', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateAutomationRule(id: string, data: Partial<AutomationRule>) {
    return this.request<ApiResponse<AutomationRule>>(`/intelligence/automations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteAutomationRule(id: string) {
    return this.request<ApiResponse<void>>(`/intelligence/automations/${id}`, {
      method: 'DELETE',
    })
  }

  async toggleAutomationRule(id: string, isActive: boolean) {
    return this.request<ApiResponse<AutomationRule>>(`/intelligence/automations/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ isActive }),
    })
  }

  async testAutomationRule(id: string) {
    return this.request<ApiResponse<{ success: boolean; result: any }>>(`/intelligence/automations/${id}/test`, {
      method: 'POST',
    })
  }

  // Intelligence Dashboard
  async getIntelligenceDashboard() {
    return this.request<ApiResponse<{
      alertsSummary: { unread: number; critical: number; warning: number }
      topInsights: BusinessInsight[]
      activeAutomations: number
      recentActivity: { type: string; description: string; timestamp: string }[]
      healthScore: number
      recommendations: string[]
    }>>('/intelligence/dashboard')
  }

  // ============================================================================
  // AI ORCHESTRATION
  // ============================================================================

  async getAIHealth() {
    return this.request<ApiResponse<{
      healthy: boolean
      providers: Record<string, boolean>
    }>>('/ai/health')
  }

  async getAIModels(taskType?: string) {
    const query = taskType ? `?task=${taskType}` : ''
    return this.request<ApiResponse<{
      count: number
      models: Array<{
        id: string
        name: string
        provider: string
        supportedTasks: string[]
        contextWindow: number
      }>
    }>>(`/ai/models${query}`)
  }

  async generateAIReviewResponseV2(review: {
    platform: string
    rating: number
    text: string
    customerName?: string
    date?: string
  }, options?: {
    tone?: 'professional' | 'friendly' | 'casual'
    language?: string
    preferredProvider?: string
  }) {
    return this.request<ApiResponse<{
      response: string
      provider: string
      model: string
      creditsUsed?: number
      latencyMs: number
    }>>('/ai/review-response', {
      method: 'POST',
      body: JSON.stringify({
        review,
        business_context: options ? {
          tone: options.tone,
          language: options.language,
        } : undefined,
        preferred_provider: options?.preferredProvider,
      }),
    })
  }

  async generateMenuDescription(item: {
    name: string
    category?: string
    ingredients?: string[]
    allergens?: string[]
    price?: number
    isVegetarian?: boolean
    isVegan?: boolean
    isGlutenFree?: boolean
  }, options?: {
    style?: 'elegant' | 'casual' | 'fun' | 'descriptive'
    language?: string
    maxLength?: number
  }) {
    return this.request<ApiResponse<{
      description: string
      provider: string
      model: string
      creditsUsed?: number
      latencyMs: number
    }>>('/ai/menu-description', {
      method: 'POST',
      body: JSON.stringify({
        item: {
          name: item.name,
          category: item.category,
          ingredients: item.ingredients,
          allergens: item.allergens,
          price: item.price,
          is_vegetarian: item.isVegetarian,
          is_vegan: item.isVegan,
          is_gluten_free: item.isGlutenFree,
        },
        style: options?.style,
        language: options?.language,
        max_length: options?.maxLength,
      }),
    })
  }

  async generateMenuDescriptionBatch(items: Array<{
    name: string
    category?: string
    ingredients?: string[]
    price?: number
    isVegetarian?: boolean
    isVegan?: boolean
    isGlutenFree?: boolean
  }>, options?: {
    style?: 'elegant' | 'casual' | 'fun' | 'descriptive'
    language?: string
  }) {
    return this.request<ApiResponse<{
      total: number
      successful: number
      failed: number
      results: Array<{
        itemName: string
        success: boolean
        description?: string
        error?: string
      }>
    }>>('/ai/menu-description/batch', {
      method: 'POST',
      body: JSON.stringify({
        items: items.map(item => ({
          name: item.name,
          category: item.category,
          ingredients: item.ingredients,
          price: item.price,
          is_vegetarian: item.isVegetarian,
          is_vegan: item.isVegan,
          is_gluten_free: item.isGlutenFree,
        })),
        style: options?.style,
        language: options?.language,
      }),
    })
  }

  async generateContent(type: 'social_post' | 'email' | 'promo' | 'announcement', topic: string, options?: {
    context?: string
    tone?: 'professional' | 'friendly' | 'exciting' | 'informative'
    platform?: 'instagram' | 'facebook' | 'twitter' | 'email' | 'whatsapp'
    language?: string
    maxLength?: number
  }) {
    return this.request<ApiResponse<{
      content: string
      type: string
      platform?: string
      provider: string
      model: string
      creditsUsed?: number
      latencyMs: number
    }>>('/ai/content', {
      method: 'POST',
      body: JSON.stringify({
        type,
        topic,
        context: options?.context,
        tone: options?.tone,
        platform: options?.platform,
        language: options?.language,
        max_length: options?.maxLength,
      }),
    })
  }

  async analyzeSentimentBatch(texts: string[]) {
    return this.request<ApiResponse<{
      results: Array<{
        text: string
        sentiment: 'positive' | 'neutral' | 'negative'
        score: number
        keywords: string[]
      }>
      summary: {
        positive: number
        neutral: number
        negative: number
        averageScore: number
      }
    }>>('/ai/sentiment', {
      method: 'POST',
      body: JSON.stringify({ texts }),
    })
  }

  async translateContent(text: string, targetLanguage: string, options?: {
    sourceLanguage?: string
    context?: 'hospitality' | 'menu' | 'formal' | 'casual'
  }) {
    return this.request<ApiResponse<{
      original: string
      translated: string
      targetLanguage: string
      sourceLanguage: string
      provider: string
      model: string
      creditsUsed?: number
      latencyMs: number
    }>>('/ai/translate', {
      method: 'POST',
      body: JSON.stringify({
        text,
        target_language: targetLanguage,
        source_language: options?.sourceLanguage,
        context: options?.context,
      }),
    })
  }

  async aiChat(messages: Array<{ role: 'user' | 'assistant'; content: string }>, options?: {
    businessContext?: string
    preferredProvider?: string
  }) {
    return this.request<ApiResponse<{
      response: string
      provider: string
      model: string
      usage?: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
      }
      creditsUsed?: number
      latencyMs: number
    }>>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages,
        business_context: options?.businessContext,
        preferred_provider: options?.preferredProvider,
      }),
    })
  }

  async getAIUsage(period?: '7d' | '30d' | '90d') {
    const query = period ? `?period=${period}` : ''
    return this.request<ApiResponse<{
      period: string
      totals: { totalRequests: number; totalCredits: number }
      byTask: Record<string, { requests: number; credits: number }>
      byProvider: Record<string, { requests: number; credits: number }>
      daily: Array<{
        taskType: string
        provider: string
        requests: number
        totalCredits: number
        avgLatencyMs: number
        date: string
      }>
    }>>(`/ai/usage${query}`)
  }

  // ============================================================================
  // AI AGENT MANAGEMENT
  // ============================================================================

  async getAgent() {
    return this.request<ApiResponse<{ agent: TenantAgent }>>('/tenant/agent')
  }

  async createAgent(data: CreateAgentInput) {
    return this.request<ApiResponse<{ agent: TenantAgent }>>('/tenant/agent', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateAgent(data: UpdateAgentInput) {
    return this.request<ApiResponse<{ agent: TenantAgent }>>('/tenant/agent', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async configureAgentChannel(channel: 'telegram' | 'whatsapp', credentials: {
    telegram_bot_token?: string
    telegram_bot_username?: string
    whatsapp_phone_id?: string
    whatsapp_access_token?: string
  }) {
    return this.request<ApiResponse<{ success: boolean; message: string }>>('/tenant/agent/channel', {
      method: 'POST',
      body: JSON.stringify({ channel, ...credentials }),
    })
  }

  async startAgent() {
    return this.request<ApiResponse<{ agent: TenantAgent; message: string }>>('/tenant/agent/start', {
      method: 'POST',
    })
  }

  async stopAgent() {
    return this.request<ApiResponse<{ agent: TenantAgent; message: string }>>('/tenant/agent/stop', {
      method: 'POST',
    })
  }

  async getAgentStats() {
    return this.request<ApiResponse<{ stats: AgentStats }>>('/tenant/agent/stats')
  }

  async getAgentConversations(params?: { status?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams(params as Record<string, string>).toString()
    return this.request<ApiResponse<{ conversations: AgentConversation[] }>>(`/tenant/agent/conversations?${query}`)
  }
}

// Agent Types
export interface TenantAgent {
  id: string
  tenant_id: string
  name: string
  avatar_url?: string
  system_prompt?: string
  model_preference: 'local' | 'anthropic' | 'openai' | 'auto'
  temperature: number
  max_tokens: number
  capabilities: AgentCapabilities
  custom_knowledge?: {
    faqs?: Array<{ question: string; answer: string }>
    policies?: Record<string, string>
    custom_instructions?: string
  }
  menu_context_enabled: boolean
  daily_message_limit: number
  monthly_token_limit: number
  messages_today: number
  tokens_this_month: number
  status: 'active' | 'inactive' | 'error'
  error_message?: string
  last_active_at?: string
  created_at: string
  updated_at: string
  telegram_bot_username?: string
  has_telegram: boolean
  has_whatsapp: boolean
}

export interface AgentCapabilities {
  can_view_menu: boolean
  can_view_hours: boolean
  can_handle_reservations: boolean
  can_process_orders: boolean
  can_access_loyalty: boolean
  languages: string[]
}

export interface AgentStats {
  messages_today: number
  messages_limit: number
  tokens_this_month: number
  tokens_limit: number
  active_conversations: number
  total_conversations: number
  avg_response_time_ms?: number
}

export interface AgentConversation {
  id: string
  channel: 'telegram' | 'whatsapp' | 'webchat'
  customer_name?: string
  message_count: number
  status: 'active' | 'closed' | 'escalated'
  escalated_to_human: boolean
  last_message_at?: string
  created_at: string
}

export interface CreateAgentInput {
  name?: string
  avatar_url?: string
  system_prompt?: string
  model_preference?: 'local' | 'anthropic' | 'openai' | 'auto'
  temperature?: number
  max_tokens?: number
  capabilities?: Partial<AgentCapabilities>
  custom_knowledge?: TenantAgent['custom_knowledge']
  menu_context_enabled?: boolean
}

export interface UpdateAgentInput extends CreateAgentInput {
  status?: 'active' | 'inactive'
}

export const api = new ApiClient()
