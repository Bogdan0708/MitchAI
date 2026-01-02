// User and Auth types
export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'owner' | 'admin' | 'manager' | 'staff'
  tenantId: string
  createdAt: string
}

export interface Tenant {
  id: string
  businessName: string
  slug: string
  tier: 'starter' | 'professional' | 'enterprise'
  createdAt: string
  onboardingComplete?: boolean
}

export interface AuthState {
  user: User | null
  tenant: Tenant | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

// Menu types
export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  categoryId: string
  categoryName?: string
  imageUrl?: string
  allergens?: string[]
  isAvailable: boolean
  aiEnhanced: boolean
}

export interface MenuCategory {
  id: string
  name: string
  description?: string
  sortOrder: number
  items?: MenuItem[]
}

// Order types
export interface Order {
  id: string
  customerId?: string
  customerName?: string
  locationId: string
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  totalAmount: number
  items: OrderItem[]
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: string
  menuItemId: string
  menuItemName: string
  quantity: number
  unitPrice: number
  notes?: string
}

// Chat types
export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  channel: 'web' | 'whatsapp' | 'voice' | 'sms'
  createdAt: string
}

export interface ChatSession {
  id: string
  customerId?: string
  customerName?: string
  customerEmail?: string
  channel: string
  lastMessageAt: string
  messageCount: number
  status: 'active' | 'resolved'
}

// Analytics types
export interface DashboardStats {
  revenue: {
    today: number
    thisWeek: number
    thisMonth: number
    percentChange: number
  }
  orders: {
    today: number
    pending: number
    percentChange: number
  }
  customers: {
    total: number
    newThisMonth: number
    percentChange: number
  }
  aiUsage: {
    tokensUsed: number
    costSaved: number
    requestsToday: number
  }
}

export interface ChartData {
  date: string
  revenue: number
  orders: number
}

// Review types
export interface Review {
  id: string
  source: 'google' | 'yelp' | 'tripadvisor' | 'facebook' | 'internal'
  rating: number
  reviewerName?: string
  reviewText: string
  reviewDate: string
  sentiment?: 'positive' | 'neutral' | 'negative'
  aiResponse?: string
  respondedAt?: string
}

// Reservation types
export interface Reservation {
  id: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  partySize: number
  reservationDate: string
  reservationTime: string
  status: 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show'
  notes?: string
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
