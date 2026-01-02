'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  DollarSign,
  ShoppingCart,
  Users,
  Zap,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  RefreshCw,
  X,
  Sparkles,
  Settings,
  MessageSquare,
  Star,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { api } from '@/lib/api'

interface DashboardStats {
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
  recentOrders: Array<{
    id: string
    customer: string
    total: number
    status: string
    time: string
  }>
}

interface ChartData {
  date: string
  revenue: number
  orders: number
}

const statusColors: Record<string, string> = {
  pending: 'warning',
  preparing: 'default',
  ready: 'success',
  delivered: 'secondary',
  completed: 'success',
}

// Demo data for when API isn't available
const fallbackStats: DashboardStats = {
  revenue: { today: 2847.50, thisWeek: 18432.75, thisMonth: 67892.00, percentChange: 12.5 },
  orders: { today: 47, pending: 5, percentChange: 8.3 },
  customers: { total: 1284, newThisMonth: 156, percentChange: 14.2 },
  aiUsage: { tokensUsed: 124500, costSaved: 342.50, requestsToday: 89 },
  recentOrders: [
    { id: 'ORD-4521', customer: 'Sarah Wilson', total: 68.50, status: 'preparing', time: '5 min ago' },
    { id: 'ORD-4520', customer: 'Mike Johnson', total: 34.25, status: 'ready', time: '12 min ago' },
    { id: 'ORD-4519', customer: 'Emma Davis', total: 89.00, status: 'delivered', time: '25 min ago' },
    { id: 'ORD-4518', customer: 'James Brown', total: 45.75, status: 'delivered', time: '32 min ago' },
    { id: 'ORD-4517', customer: 'Lisa Anderson', total: 112.50, status: 'delivered', time: '45 min ago' },
  ],
}

const fallbackChartData: ChartData[] = [
  { date: 'Mon', revenue: 2150, orders: 34 },
  { date: 'Tue', revenue: 2890, orders: 42 },
  { date: 'Wed', revenue: 2650, orders: 38 },
  { date: 'Thu', revenue: 3210, orders: 48 },
  { date: 'Fri', revenue: 3890, orders: 56 },
  { date: 'Sat', revenue: 4250, orders: 62 },
  { date: 'Sun', revenue: 2847, orders: 47 },
]

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function DashboardPage() {
  const { tenant, user } = useAuth()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats>(fallbackStats)
  const [chartData, setChartData] = useState<ChartData[]>(fallbackChartData)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)

  // Check for welcome parameter from onboarding
  useEffect(() => {
    if (searchParams.get('welcome') === 'true') {
      setShowWelcome(true)
      // Remove the query parameter from URL without refresh
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [searchParams])

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null)

      // Fetch dashboard stats
      const statsResponse = await api.getDashboardStats()
      if (statsResponse.data) {
        // API response may not include recentOrders, add fallback
        setStats({
          ...statsResponse.data,
          recentOrders: (statsResponse.data as any).recentOrders || fallbackStats.recentOrders,
        })
      }

      // Fetch revenue chart data
      const chartResponse = await api.getRevenueChart(7)
      if (chartResponse.data) {
        // Format chart data with day names
        const formattedChart = chartResponse.data.map((item: { date: string; revenue: number; orders: number }) => ({
          date: dayNames[new Date(item.date).getDay()],
          revenue: item.revenue,
          orders: item.orders,
        }))
        setChartData(formattedChart)
      }

    } catch (err) {
      console.error('Failed to fetch dashboard data:', err)
      setError('Unable to load dashboard data. Please try again.')
      // Keep showing whatever data we have
    }
  }, [])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await fetchDashboardData()
      setIsLoading(false)
    }
    loadData()
  }, [fetchDashboardData])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchDashboardData()
    setIsRefreshing(false)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-24"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-32 mb-2"></div>
                <div className="h-3 bg-muted rounded w-20"></div>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {user?.firstName || 'there'}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s happening at {tenant?.businessName || 'your restaurant'} today.
          </p>
        </div>
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

      {/* Welcome Banner */}
      {showWelcome && (
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6">
          <button
            onClick={() => setShowWelcome(false)}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Welcome to Mitch&apos;s AI! Your setup is complete.</h3>
              <p className="text-muted-foreground text-sm">
                Your 14-day free trial has started. Here are some quick actions to get you started:
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Link href="/dashboard/menu">
                  <Button size="sm" variant="outline" className="gap-2">
                    <Sparkles className="h-3 w-3" />
                    Add Menu Items
                  </Button>
                </Link>
                <Link href="/dashboard/integrations">
                  <Button size="sm" variant="outline" className="gap-2">
                    <Star className="h-3 w-3" />
                    Connect Reviews
                  </Button>
                </Link>
                <Link href="/dashboard/chat">
                  <Button size="sm" variant="outline" className="gap-2">
                    <MessageSquare className="h-3 w-3" />
                    Try AI Chat
                  </Button>
                </Link>
                <Link href="/dashboard/settings">
                  <Button size="sm" variant="outline" className="gap-2">
                    <Settings className="h-3 w-3" />
                    Settings
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today&apos;s Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.revenue.today)}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {stats.revenue.percentChange >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={stats.revenue.percentChange >= 0 ? 'text-green-500' : 'text-red-500'}>
                {stats.revenue.percentChange >= 0 ? '+' : ''}{stats.revenue.percentChange}%
              </span>
              from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Orders Today
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.orders.today}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-yellow-500 font-medium">{stats.orders.pending} pending</span>
              {' '}orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Customers
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.customers.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+{stats.customers.newThisMonth}</span>
              this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              AI Cost Savings
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.aiUsage.costSaved)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.aiUsage.requestsToday.toLocaleString()} AI requests today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue This Week</CardTitle>
            <CardDescription>Daily revenue breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-[200px] flex items-end gap-2">
                {chartData.map((day, i) => {
                  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1)
                  const height = (day.revenue / maxRevenue) * 100
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-primary/20 rounded-t relative group cursor-pointer hover:bg-primary/30 transition-colors"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      >
                        <div
                          className="absolute bottom-0 w-full bg-primary rounded-t transition-all"
                          style={{ height: '60%' }}
                        />
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {formatCurrency(day.revenue)}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{day.date}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No revenue data available yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest customer orders</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {stats.recentOrders.length > 0 ? (
              <div className="space-y-4">
                {stats.recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {order.customer.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{order.customer}</p>
                        <p className="text-xs text-muted-foreground">{order.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={statusColors[order.status] as 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'}>
                        {order.status}
                      </Badge>
                      <span className="text-sm font-medium w-16 text-right">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No recent orders
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
