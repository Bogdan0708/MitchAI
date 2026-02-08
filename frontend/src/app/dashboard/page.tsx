'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  DollarSign,
  ShoppingCart,
  Users,
  Zap,
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
import { PageHeader } from '@/components/ui/page-header'
import { StatsCard, StatsGrid } from '@/components/ui/stats-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { LoadingPage } from '@/components/ui/loading-spinner'
import { formatCurrency } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { useDashboardStats, useRevenueChart } from '@/hooks/use-analytics'

interface RecentOrder {
  id: string
  customer: string
  total: number
  status: string
  time: string
}

// Demo data for when API returns empty
const fallbackRecentOrders: RecentOrder[] = [
  { id: 'ORD-4521', customer: 'Sarah Wilson', total: 68.50, status: 'preparing', time: '5 min ago' },
  { id: 'ORD-4520', customer: 'Mike Johnson', total: 34.25, status: 'ready', time: '12 min ago' },
  { id: 'ORD-4519', customer: 'Emma Davis', total: 89.00, status: 'delivered', time: '25 min ago' },
  { id: 'ORD-4518', customer: 'James Brown', total: 45.75, status: 'delivered', time: '32 min ago' },
  { id: 'ORD-4517', customer: 'Lisa Anderson', total: 112.50, status: 'delivered', time: '45 min ago' },
]

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function DashboardPage() {
  const { tenant, user } = useAuth()
  const searchParams = useSearchParams()
  const [showWelcome, setShowWelcome] = useState(false)

  // TanStack Query hooks
  const { data: stats, isLoading: statsLoading, refetch: refetchStats, isFetching } = useDashboardStats()
  const { data: chartData } = useRevenueChart(7)

  // Check for welcome parameter from onboarding
  useEffect(() => {
    if (searchParams.get('welcome') === 'true') {
      setShowWelcome(true)
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [searchParams])

  // Format chart data with day names
  const formattedChart = chartData?.map((item: { date: string; revenue: number; orders: number }) => ({
    date: dayNames[new Date(item.date).getDay()],
    revenue: item.revenue,
    orders: item.orders,
  })) || []

  const recentOrders = (stats as any)?.recentOrders || fallbackRecentOrders

  if (statsLoading) {
    return <LoadingPage message="Loading dashboard..." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.firstName || 'there'}!`}
        description={`Here's what's happening at ${tenant?.businessName || 'your restaurant'} today.`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchStats()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

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

      {/* Stats Grid */}
      <StatsGrid columns={4}>
        <StatsCard
          title="Today's Revenue"
          value={formatCurrency(stats?.revenue?.today || 0)}
          icon={DollarSign}
          trend={{
            value: stats?.revenue?.percentChange || 0,
            label: 'from yesterday',
          }}
          loading={statsLoading}
        />
        <StatsCard
          title="Orders Today"
          value={stats?.orders?.today || 0}
          icon={ShoppingCart}
          description={`${stats?.orders?.pending || 0} pending orders`}
          loading={statsLoading}
        />
        <StatsCard
          title="Total Customers"
          value={(stats?.customers?.total || 0).toLocaleString()}
          icon={Users}
          trend={{
            value: stats?.customers?.percentChange || 0,
            label: 'this month',
          }}
          loading={statsLoading}
        />
        <StatsCard
          title="AI Cost Savings"
          value={formatCurrency(stats?.aiUsage?.costSaved || 0)}
          icon={Zap}
          description={`${(stats?.aiUsage?.requestsToday || 0).toLocaleString()} AI requests today`}
          loading={statsLoading}
        />
      </StatsGrid>

      {/* Charts and Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue This Week</CardTitle>
            <CardDescription>Daily revenue breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {formattedChart.length > 0 ? (
              <div className="h-[200px] flex items-end gap-2">
                {formattedChart.map((day: any, i: number) => {
                  const maxRevenue = Math.max(...formattedChart.map((d: any) => d.revenue), 1)
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
            <Link href="/dashboard/orders">
              <Button variant="ghost" size="sm" className="gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length > 0 ? (
              <div className="space-y-4">
                {recentOrders.map((order: RecentOrder) => (
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
                      <StatusBadge status={order.status as any} type="order" size="sm" />
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
