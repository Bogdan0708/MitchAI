'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  BarChart3, 
  DollarSign,
  Users,
  Zap,
  TrendingUp,
  ArrowLeft,
  Search
} from 'lucide-react'
import Link from 'next/link'

interface TenantUsage {
  tenantId: string
  tenantName: string
  tier: string
  totalRequests: number
  totalTokens: number
  estimatedCost: number
  monthlyRevenue: number
  margin: number
}

const TIER_REVENUE: Record<string, number> = {
  starter: 49,
  professional: 149,
  enterprise: 499,
}

export default function AdminUsagePage() {
  const [tenants, setTenants] = useState<TenantUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [totals, setTotals] = useState({
    totalRequests: 0,
    totalCost: 0,
    totalRevenue: 0,
    avgMargin: 0,
  })

  useEffect(() => {
    fetchAdminUsage()
  }, [])

  const fetchAdminUsage = async () => {
    try {
      // This would be a real admin API call
      // For now, showing the structure
      const mockData: TenantUsage[] = [
        {
          tenantId: 'e37b3ee6-08e6-458e-9334-df4c15ff0470',
          tenantName: 'Mitch From Transylvania',
          tier: 'enterprise',
          totalRequests: 156,
          totalTokens: 45000,
          estimatedCost: 0.85,
          monthlyRevenue: 499,
          margin: 99.8,
        },
        {
          tenantId: 'd2a7833e-e6aa-41f8-ba8a-9b2f858c4df5',
          tenantName: 'Test Restaurant',
          tier: 'starter',
          totalRequests: 23,
          totalTokens: 8500,
          estimatedCost: 0.12,
          monthlyRevenue: 49,
          margin: 99.8,
        },
      ]

      setTenants(mockData)

      // Calculate totals
      const totalRequests = mockData.reduce((sum, t) => sum + t.totalRequests, 0)
      const totalCost = mockData.reduce((sum, t) => sum + t.estimatedCost, 0)
      const totalRevenue = mockData.reduce((sum, t) => sum + t.monthlyRevenue, 0)
      const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0

      setTotals({ totalRequests, totalCost, totalRevenue, avgMargin })
    } catch (error) {
      console.error('Failed to fetch admin usage:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTenants = tenants.filter(t => 
    t.tenantName.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Admin: Platform Usage</h1>
          <p className="text-muted-foreground">AI usage and costs across all tenants</p>
        </div>
      </div>

      {/* Platform Totals */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants.length}</div>
            <p className="text-xs text-muted-foreground">Active restaurants</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total AI Requests</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total AI Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totals.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Platform-wide</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
              Platform Margin
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {totals.avgMargin.toFixed(1)}%
            </div>
            <p className="text-xs text-green-600 dark:text-green-500">
              Revenue: £{totals.totalRevenue} | Cost: £{totals.totalCost.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search tenants..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tenant List */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Tenant</CardTitle>
          <CardDescription>AI usage and estimated costs per restaurant</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredTenants.map((tenant) => (
              <div 
                key={tenant.tenantId}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-bold text-primary">
                      {tenant.tenantName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{tenant.tenantName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{tenant.tier}</Badge>
                      <span className="text-sm text-muted-foreground">
                        £{TIER_REVENUE[tenant.tier]}/mo
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Requests</p>
                    <p className="font-medium">{tenant.totalRequests.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Tokens</p>
                    <p className="font-medium">{tenant.totalTokens.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">AI Cost</p>
                    <p className="font-medium">£{tenant.estimatedCost.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Margin</p>
                    <p className="font-medium text-green-600">{tenant.margin.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            ))}

            {filteredTenants.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No tenants found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly P&L Summary</CardTitle>
          <CardDescription>Profit and loss projection based on current usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b">
              <span>Subscription Revenue (MRR)</span>
              <span className="font-bold text-green-600">+£{totals.totalRevenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span>AI API Costs</span>
              <span className="font-medium text-red-600">-£{totals.totalCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span>AWS Infrastructure (estimated)</span>
              <span className="font-medium text-red-600">-£75.00</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span>Other Costs (Stripe fees ~2.9%)</span>
              <span className="font-medium text-red-600">
                -£{(totals.totalRevenue * 0.029).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 text-lg font-bold">
              <span>Net Profit</span>
              <span className="text-green-600">
                £{(totals.totalRevenue - totals.totalCost - 75 - (totals.totalRevenue * 0.029)).toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
