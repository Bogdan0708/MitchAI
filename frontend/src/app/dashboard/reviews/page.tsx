'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Search, Star, Sparkles, ThumbsUp, ThumbsDown, Minus, ExternalLink,
  RefreshCw, Loader2, Filter, Download, Copy, Check, MessageSquare,
  TrendingUp, TrendingDown, AlertTriangle, BarChart3, FileText, Plus,
  Trash2, Edit
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingPage } from '@/components/ui/loading-spinner'
import { EmptyState } from '@/components/ui/empty-state'
// StatsCard not used - stats have custom icons
import { SearchInput } from '@/components/ui/search-input'
import { cn, formatDate } from '@/lib/utils'
import { api } from '@/lib/api'
import { toast } from 'sonner'

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface ReviewData {
  id: string
  platform: string
  reviewerName: string
  rating: number
  reviewText: string
  reviewDate: string
  sentiment: string
  sentimentScore?: number
  topics?: string[]
  priority?: string
  responseText: string | null
  responseDate: string | null
  responseGeneratedBy: string | null
}

interface ReviewInsights {
  totalReviews: number
  averageRating: number
  sentimentBreakdown: { positive: number; neutral: number; negative: number }
  topPositiveTopics: { topic: string; count: number; avgRating: number }[]
  topNegativeTopics: { topic: string; count: number; avgRating: number }[]
  responseRate: number
  avgResponseTime: number
}

interface ResponseTemplate {
  id: string
  name: string
  category: string
  tone: string
  templateText: string
  usageCount: number
  isActive: boolean
}

const platformConfig: Record<string, { label: string; color: string; icon: string }> = {
  google: { label: 'Google', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300', icon: 'G' },
  yelp: { label: 'Yelp', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300', icon: 'Y' },
  tripadvisor: { label: 'TripAdvisor', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300', icon: 'T' },
  facebook: { label: 'Facebook', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300', icon: 'f' },
  doordash: { label: 'DoorDash', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300', icon: 'D' },
  ubereats: { label: 'Uber Eats', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300', icon: 'U' },
  internal: { label: 'Direct', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: 'D' },
}

const sentimentConfig = {
  positive: { icon: ThumbsUp, color: 'text-green-500', bg: 'bg-green-500', label: 'Positive' },
  neutral: { icon: Minus, color: 'text-yellow-500', bg: 'bg-yellow-500', label: 'Neutral' },
  negative: { icon: ThumbsDown, color: 'text-red-500', bg: 'bg-red-500', label: 'Negative' },
}

const toneOptions = [
  { value: 'professional', label: 'Professional', description: 'Formal and business-like' },
  { value: 'friendly', label: 'Friendly', description: 'Warm and personable' },
  { value: 'apologetic', label: 'Apologetic', description: 'For negative reviews' },
  { value: 'enthusiastic', label: 'Enthusiastic', description: 'Upbeat and grateful' },
]

type TabKey = 'reviews' | 'insights' | 'templates'

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ReviewsPage() {
  // Data state
  const [reviews, setReviews] = useState<ReviewData[]>([])
  const [insights, setInsights] = useState<ReviewInsights | null>(null)
  const [templates, setTemplates] = useState<ResponseTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSentiment, setSelectedSentiment] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('reviews')

  // Action state
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [showToneSelector, setShowToneSelector] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchReviews = useCallback(async () => {
    try {
      setError(null)
      const params: { sentiment?: string; platform?: string } = {}
      if (selectedSentiment) params.sentiment = selectedSentiment
      if (selectedPlatform) params.platform = selectedPlatform

      try {
        const response = await api.getAggregatedReviews(params)
        if (response.items) {
          setReviews(response.items.map((r: any) => ({
            id: r.id,
            platform: r.platform,
            reviewerName: r.reviewerName || 'Anonymous',
            rating: r.rating,
            reviewText: r.reviewText,
            reviewDate: r.reviewDate,
            sentiment: r.sentimentLabel || 'neutral',
            sentimentScore: r.sentimentScore,
            topics: r.topics,
            priority: r.priority,
            responseText: r.responseText || null,
            responseDate: r.respondedAt || null,
            responseGeneratedBy: r.responseText ? 'ai' : null,
          })))
          return
        }
      } catch {
        // Fall back to old API
      }

      const response = await api.getReviews(params)
      if (response.items) {
        setReviews(response.items.map((r) => ({
          id: r.id,
          platform: r.source,
          reviewerName: r.reviewerName || 'Anonymous',
          rating: r.rating,
          reviewText: r.reviewText,
          reviewDate: r.reviewDate,
          sentiment: r.sentiment || 'neutral',
          responseText: r.aiResponse || null,
          responseDate: r.respondedAt || null,
          responseGeneratedBy: r.aiResponse ? 'ai' : null,
        })))
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err)
      setError('Unable to load reviews')
    }
  }, [selectedSentiment, selectedPlatform])

  const fetchInsights = useCallback(async () => {
    try {
      const response = await api.getReviewInsightsSummary('weekly')
      if (response.data) setInsights(response.data as any)
    } catch {
      // Demo data
      setInsights({
        totalReviews: 142,
        averageRating: 4.3,
        sentimentBreakdown: { positive: 78, neutral: 15, negative: 7 },
        topPositiveTopics: [
          { topic: 'Food Quality', count: 45, avgRating: 4.8 },
          { topic: 'Service Speed', count: 32, avgRating: 4.5 },
          { topic: 'Ambiance', count: 28, avgRating: 4.6 },
        ],
        topNegativeTopics: [
          { topic: 'Wait Time', count: 8, avgRating: 2.1 },
          { topic: 'Pricing', count: 5, avgRating: 2.5 },
        ],
        responseRate: 87,
        avgResponseTime: 4.2,
      })
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await api.getResponseTemplates()
      if (response.data) setTemplates(response.data as any)
    } catch {
      setTemplates([
        { id: '1', name: 'Thank You - 5 Star', category: 'positive', tone: 'grateful', templateText: 'Thank you so much for your wonderful review! We\'re thrilled you enjoyed your experience.', usageCount: 45, isActive: true },
        { id: '2', name: 'Service Recovery', category: 'negative', tone: 'apologetic', templateText: 'We sincerely apologize for your disappointing experience. Please reach out so we can make this right.', usageCount: 12, isActive: true },
        { id: '3', name: 'Quick Thanks', category: 'positive', tone: 'friendly', templateText: 'Thanks for the love! See you next time!', usageCount: 28, isActive: true },
      ])
    }
  }, [])

  const fetchGoogleStatus = useCallback(async () => {
    try {
      const response = await api.getGoogleBusinessStatus()
      setGoogleConnected(response.data?.connected || false)
    } catch {}
  }, [])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchReviews(), fetchGoogleStatus(), fetchInsights(), fetchTemplates()])
      setIsLoading(false)
    }
    loadData()
  }, [fetchReviews, fetchGoogleStatus, fetchInsights, fetchTemplates])

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchReviews()
    setIsRefreshing(false)
    toast.success('Reviews refreshed')
  }

  const handleSyncGoogle = async () => {
    setIsSyncing(true)
    try {
      const response = await api.syncGoogleReviews()
      toast.success(`Imported ${response.data?.newReviews || 0} new reviews!`)
      await fetchReviews()
    } catch {
      toast.error('Failed to sync reviews')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleGenerateResponse = async (reviewId: string, tone: string) => {
    setGeneratingId(reviewId)
    setShowToneSelector(null)
    try {
      const response = await api.generateAIReviewResponse(reviewId, { tone })
      if (response.data?.response) {
        setReviews(prev => prev.map(r =>
          r.id === reviewId
            ? { ...r, responseText: response.data!.response, responseGeneratedBy: 'ai', responseDate: new Date().toISOString() }
            : r
        ))
        toast.success('Response generated!')
      }
    } catch {
      toast.error('Failed to generate response')
    } finally {
      setGeneratingId(null)
    }
  }

  const handleCopyResponse = async (reviewId: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(reviewId)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const filteredReviews = reviews.filter((review) => {
    const matchesSearch = !searchQuery ||
      review.reviewText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.reviewerName?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const stats = {
    total: reviews.length,
    avgRating: reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0,
    positive: reviews.filter(r => r.sentiment === 'positive').length,
    negative: reviews.filter(r => r.sentiment === 'negative').length,
    needsResponse: reviews.filter(r => !r.responseText).length,
    responseRate: reviews.length > 0 ? Math.round((reviews.filter(r => r.responseText).length / reviews.length) * 100) : 0,
  }

  const platforms = Array.from(new Set(reviews.map(r => r.platform)))

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isLoading) {
    return <LoadingPage message="Loading reviews..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Guest Whisperer"
        description="Monitor and respond to customer reviews with AI"
        actions={
          <div className="flex items-center gap-2">
            {googleConnected && (
              <Button variant="outline" size="sm" onClick={handleSyncGoogle} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Sync Google
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Connect Google CTA */}
      {!googleConnected && reviews.length === 0 && activeTab === 'reviews' && (
        <EmptyState
          icon={Star}
          title="Import Your Reviews"
          description="Connect Google Business Profile to automatically import and manage your reviews."
        >
          <Link href="/dashboard/integrations">
            <Button><Sparkles className="h-4 w-4 mr-2" />Connect Google Business</Button>
          </Link>
        </EmptyState>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Reviews</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Average Rating</p>
            <div className="flex items-center gap-1">
              <p className="text-2xl font-bold">{stats.avgRating.toFixed(1)}</p>
              <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Positive</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-green-600">{stats.positive}</p>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Negative</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-red-600">{stats.negative}</p>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Response Rate</p>
            <p className="text-2xl font-bold">{stats.responseRate}%</p>
          </CardContent>
        </Card>
        <Card className={stats.needsResponse > 0 ? 'border-yellow-500/50' : ''}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Needs Response</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.needsResponse}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {([
          { key: 'reviews' as TabKey, label: 'Reviews', icon: MessageSquare },
          { key: 'insights' as TabKey, label: 'Insights', icon: BarChart3 },
          { key: 'templates' as TabKey, label: 'Templates', icon: FileText },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <>
          {/* Filters */}
          <div className="flex gap-4 flex-wrap items-center">
            <SearchInput
              placeholder="Search reviews..."
              value={searchQuery}
              onChange={setSearchQuery}
              className="max-w-sm"
            />

            <div className="flex gap-2">
              {Object.entries(sentimentConfig).map(([key, config]) => {
                const Icon = config.icon
                return (
                  <Button
                    key={key}
                    variant={selectedSentiment === key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedSentiment(selectedSentiment === key ? null : key)}
                  >
                    <Icon className={cn('h-3 w-3 mr-1', selectedSentiment !== key && config.color)} />
                    <span className="hidden sm:inline">{config.label}</span>
                  </Button>
                )
              })}
            </div>

            {platforms.length > 1 && (
              <div className="flex gap-2 items-center">
                <Filter className="h-4 w-4 text-muted-foreground" />
                {platforms.map(platform => (
                  <Button
                    key={platform}
                    variant={selectedPlatform === platform ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPlatform(selectedPlatform === platform ? null : platform)}
                  >
                    {platformConfig[platform]?.label || platform}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Reviews List */}
          <div className="space-y-4">
            {filteredReviews.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title={reviews.length === 0 ? 'No reviews yet' : 'No reviews match your filters'}
                description={reviews.length === 0 ? 'Connect your review platforms to get started' : 'Try adjusting your search or filters'}
              />
            ) : (
              filteredReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  isGenerating={generatingId === review.id}
                  showToneSelector={showToneSelector === review.id}
                  copiedId={copiedId}
                  onToggleToneSelector={() => setShowToneSelector(showToneSelector === review.id ? null : review.id)}
                  onGenerateResponse={(tone) => handleGenerateResponse(review.id, tone)}
                  onCopyResponse={(text) => handleCopyResponse(review.id, text)}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && insights && <InsightsTab insights={insights} />}

      {/* Templates Tab */}
      {activeTab === 'templates' && <TemplatesTab templates={templates} />}
    </div>
  )
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ReviewCard({
  review,
  isGenerating,
  showToneSelector,
  copiedId,
  onToggleToneSelector,
  onGenerateResponse,
  onCopyResponse,
}: {
  review: ReviewData
  isGenerating: boolean
  showToneSelector: boolean
  copiedId: string | null
  onToggleToneSelector: () => void
  onGenerateResponse: (tone: string) => void
  onCopyResponse: (text: string) => void
}) {
  const sentiment = sentimentConfig[review.sentiment as keyof typeof sentimentConfig]
  const SentimentIcon = sentiment?.icon || Minus

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex">
          <div className={cn('w-1', sentiment?.bg || 'bg-gray-300')} />
          <div className="flex-1 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {/* Header */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-medium">{review.reviewerName}</span>
                  <Badge variant="secondary" className={platformConfig[review.platform]?.color}>
                    {platformConfig[review.platform]?.label || review.platform}
                  </Badge>
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'h-4 w-4',
                          i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
                        )}
                      />
                    ))}
                  </div>
                  <SentimentIcon className={cn('h-4 w-4', sentiment?.color)} />
                  {review.priority === 'urgent' && <Badge variant="destructive">Urgent</Badge>}
                  <span className="text-sm text-muted-foreground">{formatDate(review.reviewDate)}</span>
                </div>

                {/* Review Text */}
                <p className="text-sm leading-relaxed">{review.reviewText}</p>

                {/* Topics */}
                {review.topics && review.topics.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {review.topics.map((topic, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{topic}</Badge>
                    ))}
                  </div>
                )}

                {/* AI Response */}
                {review.responseText && (
                  <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Your Response
                        {review.responseGeneratedBy === 'ai' && <Badge variant="secondary" className="text-xs">AI</Badge>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => onCopyResponse(review.responseText!)}>
                        {copiedId === review.id ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        {copiedId === review.id ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{review.responseText}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 flex-shrink-0">
                {!review.responseText && (
                  <div className="relative">
                    <Button size="sm" onClick={onToggleToneSelector} disabled={isGenerating}>
                      {isGenerating ? (
                        <><Loader2 className="h-3 w-3 animate-spin mr-1" />Generating...</>
                      ) : (
                        <><Sparkles className="h-3 w-3 mr-1" />Generate</>
                      )}
                    </Button>

                    {showToneSelector && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-popover border rounded-lg shadow-lg z-10 p-2">
                        <p className="text-xs font-medium text-muted-foreground px-2 py-1">Select Tone</p>
                        {toneOptions.map(tone => (
                          <button
                            key={tone.value}
                            onClick={() => onGenerateResponse(tone.value)}
                            className="w-full text-left px-3 py-2 rounded hover:bg-muted transition-colors"
                          >
                            <div className="font-medium text-sm">{tone.label}</div>
                            <div className="text-xs text-muted-foreground">{tone.description}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3 mr-1" />View
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function InsightsTab({ insights }: { insights: ReviewInsights }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Sentiment Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Sentiment Breakdown</CardTitle>
          <CardDescription>Distribution of review sentiments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(insights.sentimentBreakdown).map(([key, value]) => {
              const total = insights.sentimentBreakdown.positive + insights.sentimentBreakdown.neutral + insights.sentimentBreakdown.negative
              const percentage = total > 0 ? Math.round((value / total) * 100) : 0
              const config = sentimentConfig[key as keyof typeof sentimentConfig]
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {config && <config.icon className={cn('h-4 w-4', config.color)} />}
                      <span className="font-medium capitalize">{key}</span>
                    </div>
                    <span className="text-muted-foreground">{value} ({percentage}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', config?.bg)} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Response Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Response Metrics</CardTitle>
          <CardDescription>Your review response performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-4xl font-bold text-primary">{insights.responseRate}%</p>
              <p className="text-sm text-muted-foreground">Response Rate</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-4xl font-bold text-primary">{insights.avgResponseTime}h</p>
              <p className="text-sm text-muted-foreground">Avg Response Time</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Positive Topics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5 text-green-500" />
            Top Positive Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {insights.topPositiveTopics.map((topic, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{topic.topic}</p>
                  <p className="text-sm text-muted-foreground">{topic.count} mentions</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-green-600">{topic.avgRating.toFixed(1)}</span>
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Negative Topics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ThumbsDown className="h-5 w-5 text-red-500" />
            Areas for Improvement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {insights.topNegativeTopics.length > 0 ? (
              insights.topNegativeTopics.map((topic, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{topic.topic}</p>
                    <p className="text-sm text-muted-foreground">{topic.count} mentions</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-red-600">{topic.avgRating.toFixed(1)}</span>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">No significant negative topics found!</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function TemplatesTab({ templates }: { templates: ResponseTemplate[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Response Templates</CardTitle>
          <CardDescription>Pre-written templates for common review scenarios</CardDescription>
        </div>
        <Button><Plus className="h-4 w-4 mr-2" />Create Template</Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {templates.map((template) => (
            <div key={template.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">{template.name}</h3>
                    <Badge variant={template.category === 'positive' ? 'default' : template.category === 'negative' ? 'destructive' : 'secondary'}>
                      {template.category}
                    </Badge>
                    <Badge variant="outline">{template.tone}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{template.templateText}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <span>Used {template.usageCount} times</span>
                    <span className={template.isActive ? 'text-green-600' : 'text-gray-400'}>
                      {template.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
