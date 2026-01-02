'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ShoppingCart,
  Star,
  Calendar,
  Download,
  Zap,
  MessageSquare,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Target,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  PieChart,
  Activity,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency } from '@/lib/utils'
import { api, AnalyticsData } from '@/lib/api'

// Types
type Period = '7d' | '30d' | '90d' | '1y'

interface MetricCard {
  title: string
  value: string | number
  change: number
  changeLabel: string
  icon: React.ReactNode
  format?: 'currency' | 'number' | 'percent'
}

interface AIInsight {
  type: string
  title: string
  description: string
  impact: string
}

// Period labels mapping
const periodLabels: Record<Period, string> = {
  '7d': 'vs last week',
  '30d': 'vs last month',
  '90d': 'vs last quarter',
  '1y': 'vs last year',
}

const periods: Period[] = ['7d', '30d', '90d', '1y']

// Fallback data when API is unavailable
const fallbackRevenueData = [
  { date: 'Mon', revenue: 8240, orders: 172, lastPeriod: 7120 },
  { date: 'Tue', revenue: 9580, orders: 198, lastPeriod: 8450 },
  { date: 'Wed', revenue: 8920, orders: 186, lastPeriod: 7890 },
  { date: 'Thu', revenue: 10240, orders: 214, lastPeriod: 9120 },
  { date: 'Fri', revenue: 12450, orders: 268, lastPeriod: 10840 },
  { date: 'Sat', revenue: 14280, orders: 312, lastPeriod: 12560 },
  { date: 'Sun', revenue: 11890, orders: 248, lastPeriod: 10240 },
]

export default function AnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('30d')
  const [activeChartTab, setActiveChartTab] = useState<'revenue' | 'orders'>('revenue')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [insights, setInsights] = useState<AIInsight[]>([])

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [analyticsRes, insightsRes] = await Promise.all([
        api.getAnalytics(selectedPeriod),
        api.getAnalyticsInsights(),
      ])

      if (analyticsRes.data) {
        setAnalyticsData(analyticsRes.data)
      }

      if (insightsRes.data?.insights) {
        setInsights(insightsRes.data.insights)
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
      setError('Failed to load analytics data. Showing sample data.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedPeriod])

  // Fetch on mount and when period changes
  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Derive metrics from analytics data or use fallback
  const metrics: MetricCard[] = analyticsData ? [
    { title: 'Revenue', value: analyticsData.metrics.revenue, change: analyticsData.previousPeriod.revenue ? ((analyticsData.metrics.revenue - analyticsData.previousPeriod.revenue) / analyticsData.previousPeriod.revenue * 100) : 0, changeLabel: periodLabels[selectedPeriod], icon: <DollarSign className="h-4 w-4" />, format: 'currency' },
    { title: 'Orders', value: analyticsData.metrics.orders, change: analyticsData.previousPeriod.orders ? ((analyticsData.metrics.orders - analyticsData.previousPeriod.orders) / analyticsData.previousPeriod.orders * 100) : 0, changeLabel: periodLabels[selectedPeriod], icon: <ShoppingCart className="h-4 w-4" /> },
    { title: 'Avg Order', value: analyticsData.metrics.avgOrderValue, change: analyticsData.previousPeriod.avgOrderValue ? ((analyticsData.metrics.avgOrderValue - analyticsData.previousPeriod.avgOrderValue) / analyticsData.previousPeriod.avgOrderValue * 100) : 0, changeLabel: periodLabels[selectedPeriod], icon: <Target className="h-4 w-4" />, format: 'currency' },
    { title: 'New Customers', value: analyticsData.metrics.customers, change: analyticsData.previousPeriod.customers ? ((analyticsData.metrics.customers - analyticsData.previousPeriod.customers) / analyticsData.previousPeriod.customers * 100) : 0, changeLabel: periodLabels[selectedPeriod], icon: <Users className="h-4 w-4" /> },
  ] : [
    { title: 'Revenue', value: 0, change: 0, changeLabel: periodLabels[selectedPeriod], icon: <DollarSign className="h-4 w-4" />, format: 'currency' },
    { title: 'Orders', value: 0, change: 0, changeLabel: periodLabels[selectedPeriod], icon: <ShoppingCart className="h-4 w-4" /> },
    { title: 'Avg Order', value: 0, change: 0, changeLabel: periodLabels[selectedPeriod], icon: <Target className="h-4 w-4" />, format: 'currency' },
    { title: 'New Customers', value: 0, change: 0, changeLabel: periodLabels[selectedPeriod], icon: <Users className="h-4 w-4" /> },
  ]

  // Revenue chart data
  const revenueData = analyticsData?.revenueChart?.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
    revenue: d.current,
    orders: 0,
    lastPeriod: d.previous,
  })) || fallbackRevenueData

  // Peak hours data
  const hourlyData = analyticsData?.peakHours?.map(d => ({
    hour: `${d.hour}:00`,
    orders: d.orders,
  })) || []

  // Top items
  const topItems = analyticsData?.topItems?.map((item, i) => ({
    name: item.name,
    sales: item.orders,
    revenue: item.revenue,
    change: 0,
    category: '',
  })) || []

  // Review stats
  const reviewStats = analyticsData?.reviewStats || {
    total: 0,
    averageRating: 0,
    sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
    responseRate: 0,
  }

  // AI stats
  const aiStats = analyticsData?.aiStats || {
    totalRequests: 0,
    tokensUsed: 0,
    costSaved: 0,
    reviewsResponded: 0,
    menuItemsEnhanced: 0,
    chatMessagesHandled: 0,
  }

  const maxRevenue = Math.max(...revenueData.map(d => d.revenue), 1)
  const maxLastPeriod = Math.max(...revenueData.map(d => d.lastPeriod), 1)
  const maxOrders = Math.max(...hourlyData.map(d => d.orders), 1)

  // AI insights with icons
  const aiInsights = insights.map(insight => ({
    ...insight,
    icon: insight.type === 'opportunity' ? <TrendingUp className="h-4 w-4" /> :
          insight.type === 'alert' ? <AlertCircle className="h-4 w-4" /> :
          <CheckCircle2 className="h-4 w-4" />,
  }))

  const formatValue = (value: number, format?: string) => {
    if (format === 'currency') return formatCurrency(value)
    if (format === 'percent') return `${value}%`
    return value.toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive business intelligence powered by AI
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border bg-muted p-1">
            {periods.map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  selectedPeriod === period
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {period}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={fetchAnalytics} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <div className="text-muted-foreground">{metric.icon}</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatValue(metric.value as number, metric.format)}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {metric.change >= 0 ? (
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                )}
                <span className={metric.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {metric.change >= 0 ? '+' : ''}{metric.change}%
                </span>
                <span className="text-muted-foreground">{metric.changeLabel}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue/Orders Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Performance Trend</CardTitle>
              <CardDescription>Compare with previous period</CardDescription>
            </div>
            <div className="flex rounded-lg border bg-muted p-0.5">
              <button
                onClick={() => setActiveChartTab('revenue')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded transition-colors',
                  activeChartTab === 'revenue' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                )}
              >
                Revenue
              </button>
              <button
                onClick={() => setActiveChartTab('orders')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded transition-colors',
                  activeChartTab === 'orders' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                )}
              >
                Orders
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] flex items-end gap-3">
              {revenueData.map((day, i) => {
                const currentHeight = activeChartTab === 'revenue'
                  ? (day.revenue / maxRevenue) * 100
                  : (day.orders / Math.max(...revenueData.map(d => d.orders), 1)) * 100
                const prevHeight = (day.lastPeriod / maxLastPeriod) * 100

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full h-[220px] flex items-end gap-1">
                      {/* Previous period bar */}
                      <div
                        className="flex-1 bg-muted rounded-t transition-all cursor-pointer hover:bg-muted/80"
                        style={{ height: `${prevHeight * 0.9}%` }}
                        title={`Last period: ${activeChartTab === 'revenue' ? formatCurrency(day.lastPeriod) : day.orders}`}
                      />
                      {/* Current period bar */}
                      <div className="flex-1 relative group">
                        <div
                          className="w-full bg-primary rounded-t transition-all cursor-pointer hover:bg-primary/90"
                          style={{ height: `${currentHeight}%` }}
                        />
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-popover border rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {activeChartTab === 'revenue' ? formatCurrency(day.revenue) : `${day.orders} orders`}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{day.date}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-primary" />
                <span>Current Period</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-muted" />
                <span>Previous Period</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Peak Hours Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Peak Hours
            </CardTitle>
            <CardDescription>Order distribution by hour</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {hourlyData.length > 0 ? hourlyData.map((hour, i) => {
                const intensity = hour.orders / maxOrders
                return (
                  <div key={i} className="flex items-center gap-2 group">
                    <span className="text-xs text-muted-foreground w-10">{hour.hour}</span>
                    <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded transition-all group-hover:opacity-80',
                          intensity > 0.8 ? 'bg-red-500' :
                          intensity > 0.6 ? 'bg-orange-500' :
                          intensity > 0.4 ? 'bg-yellow-500' :
                          intensity > 0.2 ? 'bg-green-500' :
                          'bg-green-300'
                        )}
                        style={{ width: `${intensity * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-8 text-right">{hour.orders}</span>
                  </div>
                )
              }) : (
                <p className="text-sm text-muted-foreground text-center py-4">No peak hours data available</p>
              )}
            </div>
            <div className="flex items-center justify-between text-xs mt-4 pt-4 border-t">
              <span className="text-muted-foreground">Low Traffic</span>
              <div className="flex gap-1">
                <div className="w-4 h-2 rounded bg-green-300" />
                <div className="w-4 h-2 rounded bg-green-500" />
                <div className="w-4 h-2 rounded bg-yellow-500" />
                <div className="w-4 h-2 rounded bg-orange-500" />
                <div className="w-4 h-2 rounded bg-red-500" />
              </div>
              <span className="text-muted-foreground">High Traffic</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviews & Top Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Review Analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              Review Analytics
            </CardTitle>
            <CardDescription>Sentiment analysis and ratings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Rating Overview */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold">{reviewStats.averageRating.toFixed(1)}</div>
                <div className="flex items-center justify-center gap-0.5 my-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        'h-4 w-4',
                        star <= Math.round(reviewStats.averageRating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted'
                      )}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{reviewStats.total} reviews</p>
              </div>

              {/* Rating Distribution - placeholder since API doesn't provide this */}
              <div className="flex-1 space-y-1.5">
                {[5, 4, 3, 2, 1].map((stars) => (
                  <div key={stars} className="flex items-center gap-2">
                    <span className="text-xs w-3">{stars}</span>
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-yellow-400 rounded" style={{ width: '0%' }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-8">-</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sentiment Breakdown */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 text-center">
                <ThumbsUp className="h-5 w-5 mx-auto text-green-600 mb-1" />
                <p className="text-lg font-bold text-green-600">{reviewStats.sentimentBreakdown?.positive || 0}</p>
                <p className="text-xs text-green-600">Positive</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 text-center">
                <Minus className="h-5 w-5 mx-auto text-gray-500 mb-1" />
                <p className="text-lg font-bold text-gray-600">{reviewStats.sentimentBreakdown?.neutral || 0}</p>
                <p className="text-xs text-gray-500">Neutral</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 text-center">
                <ThumbsDown className="h-5 w-5 mx-auto text-red-600 mb-1" />
                <p className="text-lg font-bold text-red-600">{reviewStats.sentimentBreakdown?.negative || 0}</p>
                <p className="text-xs text-red-600">Negative</p>
              </div>
            </div>

            {/* Response Stats */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <p className="text-sm font-medium">Response Rate</p>
                <p className="text-2xl font-bold text-primary">{reviewStats.responseRate}%</p>
              </div>
              <div>
                <p className="text-sm font-medium">Total Reviews</p>
                <p className="text-2xl font-bold">{reviewStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Top Selling Items
            </CardTitle>
            <CardDescription>Best performers this period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topItems.length > 0 ? topItems.map((item, i) => {
                const maxSales = Math.max(...topItems.map(i => i.sales), 1)
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium',
                          i === 0 ? 'bg-yellow-100 text-yellow-700' :
                          i === 1 ? 'bg-gray-100 text-gray-700' :
                          i === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-muted text-muted-foreground'
                        )}>
                          #{i + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatCurrency(item.revenue)}</p>
                        <p className={cn(
                          'text-xs flex items-center justify-end gap-1',
                          item.change >= 0 ? 'text-green-500' : 'text-red-500'
                        )}>
                          {item.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {item.change >= 0 ? '+' : ''}{item.change}%
                        </p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-primary rounded transition-all"
                        style={{ width: `${(item.sales / maxSales) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-right">{item.sales} sales</p>
                  </div>
                )
              }) : (
                <p className="text-sm text-muted-foreground text-center py-4">No sales data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle>AI-Powered Insights</CardTitle>
              <CardDescription>Actionable recommendations based on your data</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiInsights.length > 0 ? aiInsights.map((insight, i) => (
              <div
                key={i}
                className={cn(
                  'p-4 rounded-lg border',
                  insight.type === 'opportunity' ? 'bg-blue-50/50 border-blue-200 dark:bg-blue-950/20' :
                  insight.type === 'alert' ? 'bg-yellow-50/50 border-yellow-200 dark:bg-yellow-950/20' :
                  'bg-green-50/50 border-green-200 dark:bg-green-950/20'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                    insight.type === 'opportunity' ? 'bg-blue-100 text-blue-600' :
                    insight.type === 'alert' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-green-100 text-green-600'
                  )}>
                    {insight.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{insight.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                    <Badge
                      variant="secondary"
                      className={cn(
                        'mt-2 text-[10px]',
                        insight.type === 'opportunity' ? 'bg-blue-100 text-blue-700' :
                        insight.type === 'alert' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      )}
                    >
                      {insight.impact}
                    </Badge>
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-4 col-span-2">No AI insights available yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Usage Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle>AI Usage & Savings</CardTitle>
          </div>
          <CardDescription>Track your AI-powered features usage and cost savings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Requests</p>
              <p className="text-xl font-bold">{aiStats.totalRequests.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-xs text-muted-foreground mb-1">Tokens Used</p>
              <p className="text-xl font-bold">{(aiStats.tokensUsed / 1000000).toFixed(1)}M</p>
            </div>
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 text-center">
              <p className="text-xs text-green-600 mb-1">Cost Saved</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(aiStats.costSaved)}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-xs text-muted-foreground mb-1">Chat Messages</p>
              <p className="text-xl font-bold">{aiStats.chatMessagesHandled}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-xs text-muted-foreground mb-1">Menu Enhanced</p>
              <p className="text-xl font-bold">{aiStats.menuItemsEnhanced}</p>
            </div>
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-xs text-muted-foreground mb-1">Review Responses</p>
              <p className="text-xl font-bold">{aiStats.reviewsResponded}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
