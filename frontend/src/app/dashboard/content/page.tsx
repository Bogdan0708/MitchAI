'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import {
  Calendar,
  Plus,
  RefreshCw,
  Instagram,
  Facebook,
  Youtube,
  Twitter,
  Sparkles,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
  Target,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface ContentItem {
  id: string
  title: string
  contentType: string
  platforms: string[]
  caption?: string
  scheduledAt?: string
  status: string
  engagement?: { likes: number; comments: number; shares: number; views: number }
}

interface Campaign {
  id: string
  name: string
  status: string
  startDate: string
  endDate: string
  contentCount: number
  totalEngagement: number
}

interface SocialAccount {
  id: string
  platform: string
  accountName: string
  followerCount?: number
  isConnected: boolean
}

interface ContentIdea {
  id: string
  title: string
  description?: string
  contentType: string
  trendingScore: number
  source: string
}

interface TrendingTopic {
  id: string
  topic: string
  platform: string
  trendScore: number
  relatedHashtags: string[]
}

export default function ContentPage() {
  const [contentItems, setContentItems] = useState<ContentItem[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [trending, setTrending] = useState<TrendingTopic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'calendar' | 'campaigns' | 'ideas' | 'accounts'>('calendar')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [contentRes, campaignsRes, accountsRes, ideasRes, trendingRes] = await Promise.all([
        api.getContentCalendar().catch(() => null),
        api.getCampaigns().catch(() => null),
        api.getSocialAccounts().catch(() => null),
        api.getContentIdeas().catch(() => null),
        api.getTrendingTopics().catch(() => null),
      ])

      if (Array.isArray(contentRes?.data)) setContentItems(contentRes.data)
      if (Array.isArray(campaignsRes?.data)) setCampaigns(campaignsRes.data)
      if (Array.isArray(accountsRes?.data)) setAccounts(accountsRes.data)
      if (Array.isArray(ideasRes?.data)) setIdeas(ideasRes.data)
      if (Array.isArray(trendingRes?.data)) setTrending(trendingRes.data)
    } catch (err) {
      setError('Failed to load content data')
      // Set demo data
      setContentItems([
        { id: '1', title: 'Weekend Special Announcement', contentType: 'post', platforms: ['instagram', 'facebook'], scheduledAt: '2026-01-26T10:00:00Z', status: 'scheduled' },
        { id: '2', title: 'Behind the Scenes: Kitchen Prep', contentType: 'reel', platforms: ['instagram', 'tiktok'], scheduledAt: '2026-01-27T14:00:00Z', status: 'scheduled' },
        { id: '3', title: 'Chef Interview', contentType: 'video', platforms: ['youtube'], status: 'draft' },
        { id: '4', title: 'Happy Hour Promo', contentType: 'story', platforms: ['instagram'], scheduledAt: '2026-01-25T17:00:00Z', status: 'published', engagement: { likes: 245, comments: 18, shares: 12, views: 1520 } },
      ])
      setCampaigns([
        { id: '1', name: 'Winter Menu Launch', status: 'active', startDate: '2026-01-15', endDate: '2026-02-15', contentCount: 12, totalEngagement: 5430 },
        { id: '2', name: 'Valentine\'s Day Special', status: 'draft', startDate: '2026-02-01', endDate: '2026-02-14', contentCount: 8, totalEngagement: 0 },
      ])
      setAccounts([
        { id: '1', platform: 'instagram', accountName: '@mitchrestaurant', followerCount: 12500, isConnected: true },
        { id: '2', platform: 'facebook', accountName: 'Mitch Restaurant', followerCount: 8300, isConnected: true },
        { id: '3', platform: 'tiktok', accountName: '@mitcheats', followerCount: 4200, isConnected: true },
        { id: '4', platform: 'youtube', accountName: 'Mitch Kitchen', followerCount: 1800, isConnected: false },
      ])
      setIdeas([
        { id: '1', title: 'Time-lapse of dish preparation', description: 'Show the entire process of making our signature dish', contentType: 'reel', trendingScore: 85, source: 'ai' },
        { id: '2', title: 'Customer testimonial series', description: 'Feature happy customers sharing their experience', contentType: 'video', trendingScore: 78, source: 'ai' },
        { id: '3', title: 'Ingredient spotlight: Local farms', description: 'Showcase our farm-to-table partnerships', contentType: 'carousel', trendingScore: 72, source: 'trending' },
      ])
      setTrending([
        { id: '1', topic: '#FoodTok', platform: 'tiktok', trendScore: 95, relatedHashtags: ['#foodie', '#restaurant', '#chef'] },
        { id: '2', topic: '#SundayBrunch', platform: 'instagram', trendScore: 88, relatedHashtags: ['#brunchvibes', '#weekendfood'] },
        { id: '3', topic: '#BehindTheScenes', platform: 'instagram', trendScore: 82, relatedHashtags: ['#kitchenlife', '#cheflife'] },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'instagram': return <Instagram className="h-4 w-4" />
      case 'facebook': return <Facebook className="h-4 w-4" />
      case 'youtube': return <Youtube className="h-4 w-4" />
      case 'twitter': return <Twitter className="h-4 w-4" />
      case 'tiktok': return <span className="text-xs font-bold">TT</span>
      default: return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published': return <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Published</Badge>
      case 'scheduled': return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>
      case 'draft': return <Badge variant="secondary">Draft</Badge>
      case 'failed': return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
      default: return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Content Planner</h1>
            <p className="text-muted-foreground">Loading content data...</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const scheduledCount = contentItems.filter(c => c.status === 'scheduled').length
  const publishedCount = contentItems.filter(c => c.status === 'published').length
  const totalEngagement = contentItems.reduce((sum, c) => sum + (c.engagement?.likes || 0) + (c.engagement?.comments || 0) + (c.engagement?.shares || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content Planner</h1>
          <p className="text-muted-foreground">
            Schedule and manage social media content across all platforms
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Generate
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Post
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Scheduled</p>
                <p className="text-3xl font-bold">{scheduledCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Published</p>
                <p className="text-3xl font-bold">{publishedCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Engagement</p>
                <p className="text-3xl font-bold">{formatNumber(totalEngagement)}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-pink-100 flex items-center justify-center">
                <Heart className="h-6 w-6 text-pink-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Connected</p>
                <p className="text-3xl font-bold">{accounts.filter(a => a.isConnected).length}</p>
                <p className="text-sm text-muted-foreground">of {accounts.length} platforms</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['calendar', 'campaigns', 'ideas', 'accounts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'ideas' ? 'Content Ideas' : tab === 'accounts' ? 'Social Accounts' : tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'calendar' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Content List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Upcoming Content</CardTitle>
                  <CardDescription>Scheduled and draft posts</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium min-w-[120px] text-center">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {contentItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {item.contentType === 'reel' ? 'R' : item.contentType === 'story' ? 'S' : item.contentType === 'video' ? 'V' : 'P'}
                        </div>
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex gap-1">
                              {item.platforms.map(p => (
                                <span key={p} className="text-muted-foreground">{getPlatformIcon(p)}</span>
                              ))}
                            </div>
                            {item.scheduledAt && (
                              <span className="text-sm text-muted-foreground">
                                {new Date(item.scheduledAt).toLocaleDateString()} at {new Date(item.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {item.engagement && (
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{formatNumber(item.engagement.likes)}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{formatNumber(item.engagement.comments)}</span>
                            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatNumber(item.engagement.views)}</span>
                          </div>
                        )}
                        {getStatusBadge(item.status)}
                        <Button variant="ghost" size="sm">Edit</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trending Topics Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-pink-500" />
                  Trending Now
                </CardTitle>
                <CardDescription>Popular topics for your content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trending.map((topic) => (
                    <div key={topic.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-primary">{topic.topic}</span>
                        <Badge variant="outline">{topic.trendScore}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{topic.platform}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {topic.relatedHashtags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-xs text-muted-foreground">{tag}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-500" />
                  AI Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ideas.slice(0, 2).map((idea) => (
                    <div key={idea.id} className="p-3 border rounded-lg">
                      <p className="font-medium text-sm">{idea.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{idea.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="outline" className="text-xs">{idea.contentType}</Badge>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">Use Idea</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'campaigns' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Marketing Campaigns</CardTitle>
              <CardDescription>Organize content into themed campaigns</CardDescription>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className="relative overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{campaign.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={campaign.status === 'active' ? 'success' : 'secondary'}>{campaign.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{campaign.contentCount}</p>
                        <p className="text-sm text-muted-foreground">Posts</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{formatNumber(campaign.totalEngagement)}</p>
                        <p className="text-sm text-muted-foreground">Engagement</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" className="flex-1">View</Button>
                      <Button className="flex-1">Add Content</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'ideas' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Content Ideas</CardTitle>
                <CardDescription>AI-generated and trending content suggestions</CardDescription>
              </div>
              <Button>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate More
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ideas.map((idea) => (
                  <div key={idea.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{idea.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{idea.description}</p>
                      </div>
                      <Badge variant={idea.source === 'ai' ? 'outline' : 'secondary'}>
                        {idea.source === 'ai' ? <Sparkles className="h-3 w-3 mr-1" /> : <TrendingUp className="h-3 w-3 mr-1" />}
                        {idea.source}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{idea.contentType}</Badge>
                        <span className="text-sm text-muted-foreground">Score: {idea.trendingScore}%</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">Dismiss</Button>
                        <Button size="sm">Create Post</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Trending Topics</CardTitle>
              <CardDescription>What's popular right now</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {trending.map((topic) => (
                  <div key={topic.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white">
                          <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium">{topic.topic}</p>
                          <p className="text-sm text-muted-foreground capitalize">{topic.platform}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{topic.trendScore}%</p>
                        <p className="text-xs text-muted-foreground">Trend Score</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {topic.relatedHashtags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'accounts' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>Manage your social media connections</CardDescription>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Connect Account
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {accounts.map((account) => (
                <Card key={account.id} className={`relative overflow-hidden ${!account.isConnected ? 'opacity-60' : ''}`}>
                  <CardContent className="p-6 text-center">
                    <div className={`h-16 w-16 rounded-full mx-auto flex items-center justify-center text-white ${
                      account.platform === 'instagram' ? 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500' :
                      account.platform === 'facebook' ? 'bg-blue-600' :
                      account.platform === 'tiktok' ? 'bg-black' :
                      account.platform === 'youtube' ? 'bg-red-600' : 'bg-gray-600'
                    }`}>
                      {account.platform === 'instagram' && <Instagram className="h-8 w-8" />}
                      {account.platform === 'facebook' && <Facebook className="h-8 w-8" />}
                      {account.platform === 'youtube' && <Youtube className="h-8 w-8" />}
                      {account.platform === 'tiktok' && <span className="text-2xl font-bold">TT</span>}
                    </div>
                    <h3 className="font-semibold mt-4">{account.accountName}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{account.platform}</p>
                    {account.followerCount && (
                      <p className="text-2xl font-bold mt-2">{formatNumber(account.followerCount)}</p>
                    )}
                    <p className="text-sm text-muted-foreground">followers</p>
                    <div className="mt-4">
                      {account.isConnected ? (
                        <Badge variant="success" className="w-full justify-center">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Button variant="outline" className="w-full">Connect</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          Note: Using demo data. {error}
        </div>
      )}
    </div>
  )
}
