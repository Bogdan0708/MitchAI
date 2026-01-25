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

// ============================================================================
// COMPLIANCE MODULE TYPES (Food Safety)
// ============================================================================

export interface ComplianceTemplate {
  id: string
  tenantId: string
  locationId?: string
  name: string
  description?: string
  category: 'temperature' | 'cleaning' | 'receiving' | 'allergen' | 'pest_control' | 'opening' | 'closing' | 'custom'
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually' | 'on_demand'
  timeWindows?: { start: string; end: string }[]
  checklistItems: { id: string; label: string; type: 'checkbox' | 'temperature' | 'text' | 'photo'; required: boolean }[]
  regulatoryReference?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ComplianceCheck {
  id: string
  templateId: string
  templateName: string
  locationId: string
  completedBy: string
  completedByName: string
  status: 'passed' | 'failed' | 'requires_action' | 'pending'
  responses: Record<string, any>
  notes?: string
  photoUrls?: string[]
  completedAt: string
  createdAt: string
}

export interface Equipment {
  id: string
  tenantId: string
  locationId: string
  name: string
  equipmentType: 'fridge' | 'freezer' | 'hot_holding' | 'probe' | 'dishwasher' | 'oven' | 'grill' | 'other'
  serialNumber?: string
  manufacturer?: string
  model?: string
  tempLowerLimit?: number
  tempUpperLimit?: number
  calibrationDueDate?: string
  lastServiceDate?: string
  nextServiceDate?: string
  status: 'active' | 'maintenance' | 'retired'
  iotDeviceId?: string
  createdAt: string
}

export interface TemperatureLog {
  id: string
  equipmentId: string
  equipmentName: string
  locationId: string
  temperature: number
  unit: 'celsius' | 'fahrenheit'
  isWithinRange: boolean
  recordedBy?: string
  recordedByName?: string
  source: 'manual' | 'iot'
  createdAt: string
}

export interface CorrectiveAction {
  id: string
  tenantId: string
  locationId: string
  sourceType: 'compliance_check' | 'temperature_log' | 'audit' | 'customer_complaint' | 'other'
  sourceId?: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress' | 'resolved' | 'verified'
  assignedTo?: string
  assignedToName?: string
  dueDate?: string
  resolvedAt?: string
  verifiedBy?: string
  resolutionNotes?: string
  createdAt: string
}

export interface HACCPPlan {
  id: string
  tenantId: string
  name: string
  version: string
  status: 'draft' | 'active' | 'archived'
  criticalControlPoints: {
    id: string
    hazard: string
    controlMeasure: string
    criticalLimits: string
    monitoringProcedure: string
    correctiveAction: string
  }[]
  createdAt: string
  updatedAt: string
}

// ============================================================================
// REVIEW MANAGEMENT MODULE TYPES (Guest Whisperer)
// ============================================================================

export interface AggregatedReview {
  id: string
  tenantId: string
  locationId?: string
  platform: 'google' | 'yelp' | 'tripadvisor' | 'facebook' | 'opentable' | 'doordash' | 'ubereats' | 'internal'
  platformReviewId?: string
  reviewerName: string
  reviewerProfileUrl?: string
  rating: number
  reviewText: string
  reviewDate: string
  sentimentScore?: number
  sentimentLabel?: 'positive' | 'neutral' | 'negative'
  topics?: string[]
  keywords?: string[]
  status: 'new' | 'read' | 'responded' | 'flagged' | 'archived'
  priority: 'urgent' | 'high' | 'normal' | 'low'
  isResponded: boolean
  responseText?: string
  respondedAt?: string
  respondedBy?: string
  aiSuggestedResponse?: string
  createdAt: string
}

export interface ReviewResponseTemplate {
  id: string
  tenantId: string
  name: string
  category: 'positive' | 'neutral' | 'negative' | 'complaint' | 'thanks'
  tone: 'professional' | 'friendly' | 'apologetic' | 'grateful'
  templateText: string
  variables: string[]
  usageCount: number
  isActive: boolean
  createdAt: string
}

export interface ReviewInsights {
  id: string
  tenantId: string
  periodType: 'daily' | 'weekly' | 'monthly'
  periodStart: string
  periodEnd: string
  totalReviews: number
  averageRating: number
  sentimentBreakdown: { positive: number; neutral: number; negative: number }
  topPositiveTopics: { topic: string; count: number; avgRating: number }[]
  topNegativeTopics: { topic: string; count: number; avgRating: number }[]
  responseRate: number
  avgResponseTime: number
  competitorComparison?: { name: string; rating: number; reviewCount: number }[]
  createdAt: string
}

export interface ReviewPlatformConnection {
  id: string
  tenantId: string
  platform: string
  isConnected: boolean
  lastSyncAt?: string
  profileUrl?: string
  credentials?: Record<string, any>
  syncSettings: { autoSync: boolean; syncFrequency: string }
  createdAt: string
}

// ============================================================================
// CONTENT PLANNER MODULE TYPES (Social Media)
// ============================================================================

export interface ContentCalendarItem {
  id: string
  tenantId: string
  locationId?: string
  campaignId?: string
  title: string
  contentType: 'post' | 'story' | 'reel' | 'video' | 'carousel' | 'blog'
  platforms: ('instagram' | 'facebook' | 'tiktok' | 'twitter' | 'linkedin' | 'youtube')[]
  caption?: string
  hashtags?: string[]
  mediaUrls?: string[]
  scheduledAt?: string
  publishedAt?: string
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'archived'
  aiGenerated: boolean
  engagement?: { likes: number; comments: number; shares: number; views: number }
  createdBy: string
  createdAt: string
}

export interface ContentCampaign {
  id: string
  tenantId: string
  name: string
  description?: string
  startDate: string
  endDate: string
  goals?: string[]
  targetAudience?: string
  budget?: number
  status: 'draft' | 'active' | 'paused' | 'completed'
  contentCount: number
  totalEngagement: number
  createdAt: string
}

export interface SocialAccount {
  id: string
  tenantId: string
  platform: 'instagram' | 'facebook' | 'tiktok' | 'twitter' | 'linkedin' | 'youtube'
  accountId: string
  accountName: string
  profileUrl?: string
  followerCount?: number
  isConnected: boolean
  accessToken?: string
  tokenExpiresAt?: string
  lastPostAt?: string
  createdAt: string
}

export interface ContentIdea {
  id: string
  tenantId: string
  title: string
  description?: string
  contentType: string
  suggestedPlatforms: string[]
  trendingScore: number
  source: 'ai' | 'trending' | 'competitor' | 'user'
  sourceReference?: string
  status: 'new' | 'saved' | 'used' | 'dismissed'
  createdAt: string
}

export interface TrendingTopic {
  id: string
  topic: string
  platform: string
  category: string
  trendScore: number
  volume: number
  sentiment: 'positive' | 'neutral' | 'negative'
  relatedHashtags: string[]
  expiresAt: string
  createdAt: string
}

// ============================================================================
// BUSINESS INTELLIGENCE MODULE TYPES
// ============================================================================

export interface BusinessAlert {
  id: string
  tenantId: string
  locationId?: string
  alertType: 'review' | 'compliance' | 'sales' | 'inventory' | 'staffing' | 'system'
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  sourceType: 'review' | 'compliance_check' | 'temperature_log' | 'order' | 'system'
  sourceId?: string
  isRead: boolean
  isResolved: boolean
  resolvedAt?: string
  resolvedBy?: string
  actionUrl?: string
  metadata?: Record<string, any>
  createdAt: string
}

export interface BusinessInsight {
  id: string
  tenantId: string
  locationId?: string
  insightType: 'opportunity' | 'risk' | 'trend' | 'recommendation' | 'anomaly'
  category: 'revenue' | 'operations' | 'customer' | 'compliance' | 'marketing'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  confidence: number
  dataPoints: Record<string, any>
  suggestedActions: string[]
  isActionable: boolean
  validUntil: string
  createdAt: string
}

export interface AlertRule {
  id: string
  tenantId: string
  name: string
  description?: string
  ruleType: 'threshold' | 'pattern' | 'schedule' | 'comparison'
  sourceType: string
  conditions: Record<string, any>
  actions: { type: string; config: Record<string, any> }[]
  isActive: boolean
  lastTriggeredAt?: string
  triggerCount: number
  createdAt: string
}

export interface AutomationRule {
  id: string
  tenantId: string
  name: string
  description?: string
  triggerType: 'event' | 'schedule' | 'condition'
  triggerConfig: Record<string, any>
  actions: { type: string; config: Record<string, any>; order: number }[]
  isActive: boolean
  lastRunAt?: string
  runCount: number
  successCount: number
  failureCount: number
  createdAt: string
}
