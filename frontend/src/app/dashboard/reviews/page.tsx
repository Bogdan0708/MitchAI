'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Search, Star, Sparkles, ThumbsUp, ThumbsDown, Minus, ExternalLink,
  RefreshCw, Loader2, Filter, Download, Copy, Check, MessageSquare,
  TrendingUp, TrendingDown, AlertCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import { api } from '@/lib/api'

const platformConfig: Record<string, { label: string; color: string; icon: string }> = {
  google: { label: 'Google', color: 'bg-blue-100 text-blue-800', icon: 'G' },
  yelp: { label: 'Yelp', color: 'bg-red-100 text-red-800', icon: 'Y' },
  tripadvisor: { label: 'TripAdvisor', color: 'bg-green-100 text-green-800', icon: 'T' },
  facebook: { label: 'Facebook', color: 'bg-indigo-100 text-indigo-800', icon: 'f' },
  internal: { label: 'Direct', color: 'bg-gray-100 text-gray-800', icon: 'D' },
}

const sentimentConfig = {
  positive: { icon: ThumbsUp, color: 'text-green-500', bg: 'bg-green-50', label: 'Positive' },
  neutral: { icon: Minus, color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Neutral' },
  negative: { icon: ThumbsDown, color: 'text-red-500', bg: 'bg-red-50', label: 'Negative' },
}

const toneOptions = [
  { value: 'professional', label: 'Professional', description: 'Formal and business-like' },
  { value: 'friendly', label: 'Friendly', description: 'Warm and personable' },
  { value: 'apologetic', label: 'Apologetic', description: 'For negative reviews' },
  { value: 'enthusiastic', label: 'Enthusiastic', description: 'Upbeat and grateful' },
]

interface ReviewData {
  id: string
  platform: string
  reviewerName: string
  rating: number
  reviewText: string
  reviewDate: string
  sentiment: string
  sentimentScore?: number
  responseText: string | null
  responseDate: string | null
  responseGeneratedBy: string | null
}

interface GoogleStatus {
  connected: boolean
  profile: {
    name: string
    rating: number
    totalReviews: number
    lastSyncAt: string | null
  } | null
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSentiment, setSelectedSentiment] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [selectedTone, setSelectedTone] = useState('professional')
  const [showToneSelector, setShowToneSelector] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null)

  const fetchReviews = useCallback(async () => {
    try {
      setError(null)
      const params: { sentiment?: string; platform?: string } = {}
      if (selectedSentiment) params.sentiment = selectedSentiment
      if (selectedPlatform) params.platform = selectedPlatform

      const response = await api.getReviews(params)
      if (response.items) {
        // Map API Review type to local ReviewData type
        const mappedReviews: ReviewData[] = response.items.map((r) => ({
          id: r.id,
          platform: r.source,
          reviewerName: r.reviewerName || 'Anonymous',
          rating: r.rating,
          reviewText: r.reviewText,
          reviewDate: r.reviewDate,
          sentiment: r.sentiment || 'neutral',
          sentimentScore: undefined,
          responseText: r.aiResponse || null,
          responseDate: r.respondedAt || null,
          responseGeneratedBy: r.aiResponse ? 'ai' : null,
        }))
        setReviews(mappedReviews)
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err)
      setError('Unable to load reviews. Please try again.')
    }
  }, [selectedSentiment, selectedPlatform])

  const fetchGoogleStatus = useCallback(async () => {
    try {
      const response = await api.getGoogleBusinessStatus()
      if (response.data) {
        setGoogleStatus(response.data)
      }
    } catch (err) {
      console.error('Failed to fetch Google status:', err)
    }
  }, [])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchReviews(), fetchGoogleStatus()])
      setIsLoading(false)
    }
    loadData()
  }, [fetchReviews, fetchGoogleStatus])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchReviews()
    setIsRefreshing(false)
  }

  const handleSyncGoogle = async () => {
    setIsSyncing(true)
    setSyncMessage(null)
    try {
      const response = await api.syncGoogleReviews()
      if (response.data) {
        setSyncMessage(`Imported ${response.data.newReviews} new reviews!`)
        await fetchReviews()
      }
    } catch (err) {
      setError('Failed to sync reviews from Google.')
    } finally {
      setIsSyncing(false)
      setTimeout(() => setSyncMessage(null), 3000)
    }
  }

  const handleGenerateResponse = async (reviewId: string, tone: string) => {
    setGeneratingId(reviewId)
    setShowToneSelector(null)
    try {
      const response = await api.generateReviewResponse(reviewId, {
        tone,
        maxLength: 200,
      })

      const generatedResponse = response.data?.response
      if (generatedResponse) {
        setReviews(prev => prev.map(r =>
          r.id === reviewId
            ? { ...r, responseText: generatedResponse, responseGeneratedBy: 'ai', responseDate: new Date().toISOString() }
            : r
        ))
      }
    } catch (err) {
      console.error('Failed to generate response:', err)
      setError('Failed to generate AI response. Please try again.')
    } finally {
      setGeneratingId(null)
    }
  }

  const handleCopyResponse = async (reviewId: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(reviewId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredReviews = reviews.filter((review) => {
    const matchesSearch = !searchQuery ||
      review.reviewText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.reviewerName?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const stats = {
    total: reviews.length,
    avgRating: reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)
      : 0,
    positive: reviews.filter(r => r.sentiment === 'positive').length,
    negative: reviews.filter(r => r.sentiment === 'negative').length,
    needsResponse: reviews.filter(r => !r.responseText).length,
    responseRate: reviews.length > 0
      ? Math.round((reviews.filter(r => r.responseText).length / reviews.length) * 100)
      : 0,
  }

  const platforms = Array.from(new Set(reviews.map(r => r.platform)))

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reviews</h1>
            <p className="text-muted-foreground">Monitor and respond to customer reviews</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-24 mb-2"></div>
                <div className="h-8 bg-muted rounded w-16"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-48 mb-3"></div>
                <div className="h-16 bg-muted rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reviews</h1>
          <p className="text-muted-foreground">Monitor and respond to customer reviews with AI</p>
        </div>
        <div className="flex items-center gap-2">
          {googleStatus?.connected && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncGoogle}
              disabled={isSyncing}
              className="gap-2"
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Sync Google
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Sync Message */}
      {syncMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <Check className="h-4 w-4" />
          {syncMessage}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Connect Google CTA */}
      {!googleStatus?.connected && reviews.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Star className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Import Your Reviews</h3>
            <p className="text-muted-foreground mb-4">
              Connect Google Business Profile to automatically import and manage your reviews.
            </p>
            <Link href="/dashboard/integrations">
              <Button className="gap-2">
                <Sparkles className="h-4 w-4" />
                Connect Google Business
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Needs Response</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.needsResponse}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reviews..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Sentiment Filters */}
        <div className="flex gap-2">
          {Object.entries(sentimentConfig).map(([key, config]) => {
            const Icon = config.icon
            return (
              <Button
                key={key}
                variant={selectedSentiment === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedSentiment(selectedSentiment === key ? null : key)}
                className="gap-1"
              >
                <Icon className={cn('h-3 w-3', selectedSentiment !== key && config.color)} />
                <span className="hidden sm:inline">{config.label}</span>
              </Button>
            )
          })}
        </div>

        {/* Platform Filter */}
        {platforms.length > 1 && (
          <div className="flex gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {platforms.map(platform => (
              <Button
                key={platform}
                variant={selectedPlatform === platform ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPlatform(selectedPlatform === platform ? null : platform)}
                className="gap-1"
              >
                <span className={cn(
                  'w-4 h-4 rounded text-xs font-bold flex items-center justify-center',
                  platformConfig[platform]?.color || 'bg-gray-100'
                )}>
                  {platformConfig[platform]?.icon || platform[0].toUpperCase()}
                </span>
                <span className="hidden sm:inline">{platformConfig[platform]?.label || platform}</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">
                {reviews.length === 0 ? 'No reviews yet' : 'No reviews match your filters'}
              </p>
              <p className="text-sm">
                {reviews.length === 0
                  ? 'Connect your review platforms to get started'
                  : 'Try adjusting your search or filters'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredReviews.map((review) => {
            const sentiment = sentimentConfig[review.sentiment as keyof typeof sentimentConfig]
            const SentimentIcon = sentiment?.icon || Minus

            return (
              <Card key={review.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex">
                    {/* Sentiment Indicator Bar */}
                    <div className={cn('w-1', sentiment?.bg || 'bg-gray-100')} />

                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          {/* Review Header */}
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="font-medium">{review.reviewerName || 'Anonymous'}</span>
                            <Badge variant="secondary" className={platformConfig[review.platform]?.color}>
                              {platformConfig[review.platform]?.label || review.platform}
                            </Badge>
                            <div className="flex items-center">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    'h-4 w-4',
                                    i < review.rating
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'text-muted-foreground/30'
                                  )}
                                />
                              ))}
                            </div>
                            <SentimentIcon className={cn('h-4 w-4', sentiment?.color)} />
                            <span className="text-sm text-muted-foreground">
                              {review.reviewDate ? formatDate(review.reviewDate) : ''}
                            </span>
                          </div>

                          {/* Review Text */}
                          <p className="text-sm leading-relaxed">{review.reviewText}</p>

                          {/* AI Response */}
                          {review.responseText && (
                            <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <Sparkles className="h-4 w-4 text-primary" />
                                  Your Response
                                  {review.responseGeneratedBy === 'ai' && (
                                    <Badge variant="secondary" className="text-xs">AI Generated</Badge>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyResponse(review.id, review.responseText!)}
                                  className="h-8 gap-1"
                                >
                                  {copiedId === review.id ? (
                                    <>
                                      <Check className="h-3 w-3" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      Copy
                                    </>
                                  )}
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
                              <Button
                                size="sm"
                                className="gap-1"
                                onClick={() => setShowToneSelector(showToneSelector === review.id ? null : review.id)}
                                disabled={generatingId === review.id}
                              >
                                {generatingId === review.id ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-3 w-3" />
                                    Generate
                                  </>
                                )}
                              </Button>

                              {/* Tone Selector Dropdown */}
                              {showToneSelector === review.id && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-popover border rounded-lg shadow-lg z-10 p-2">
                                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">Select Tone</p>
                                  {toneOptions.map(tone => (
                                    <button
                                      key={tone.value}
                                      onClick={() => handleGenerateResponse(review.id, tone.value)}
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
                          <Button variant="outline" size="sm" className="gap-1">
                            <ExternalLink className="h-3 w-3" />
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
