'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  BarChart3, 
  MessageSquare, 
  FileText, 
  Star, 
  Languages, 
  Sparkles,
  TrendingUp,
  DollarSign,
  Zap,
  Calendar,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

// Cost per action in USD (based on GPT-4o-mini primarily)
const COST_PER_ACTION: Record<string, number> = {
  chat: 0.000135,
  review_response: 0.00018,
  menu_description: 0.0000825,
  sentiment: 0.00009,
  content: 0.0069, // Claude Sonnet
  translation: 0.00012,
  menu_ai: 0.00015,
}

const FEATURE_ICONS: Record<string, any> = {
  chat: MessageSquare,
  review_response: Star,
  menu_description: FileText,
  sentiment: TrendingUp,
  content: Sparkles,
  translation: Languages,
  menu_ai: FileText,
}

const FEATURE_NAMES: Record<string, string> = {
  chat: 'AI Chat',
  review_response: 'Review Responses',
  menu_description: 'Menu Descriptions',
  sentiment: 'Sentiment Analysis',
  content: 'Content Generation',
  translation: 'Translations',
  menu_ai: 'Menu AI',
}

interface UsageData {
  period: {
    days: number
    startDate: string
    endDate: string
  }
  totalTokens: number
  totalCostUsd: number
  byProvider: Record<string, { tokens: number; cost: number }>
  byRequestType: Record<string, { tokens: number; cost: number; count?: number }>
}

interface CreditData {
  tier: string
  period: string
  creditsUsed: number
  creditsIncluded: number
  creditsRemaining: number
  overageCredits: number
  overageCharge: number
  overageRate: number
  percentUsed: number
  breakdown: Record<string, number>
}

interface DailyUsage {
  date: string
  requests: number
  tokens: number
  cost: number
}

export default function UsagePage() {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [credits, setCredits] = useState<CreditData | null>(null)
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')

  useEffect(() => {
    fetchUsage()
    fetchCredits()
  }, [period])

  const fetchCredits = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai/credits`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setCredits(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch credits:', error)
    }
  }

  const fetchUsage = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/ai/usage?days=${period.replace('d', '')}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setUsage(data)
        
        // Generate mock daily data for visualization
        // In production, this would come from the API
        const days = parseInt(period.replace('d', ''))
        const daily: DailyUsage[] = []
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          daily.push({
            date: date.toISOString().split('T')[0],
            requests: Math.floor(Math.random() * 50) + 10,
            tokens: Math.floor(Math.random() * 5000) + 500,
            cost: Math.random() * 0.05,
          })
        }
        setDailyUsage(daily)
      }
    } catch (error) {
      console.error('Failed to fetch usage:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateEstimatedMonthlyCost = () => {
    if (!usage) return 0
    const days = usage.period.days
    const dailyAvg = usage.totalCostUsd / days
    return dailyAvg * 30
  }

  const getTotalRequests = () => {
    if (!usage?.byRequestType) return 0
    return Object.values(usage.byRequestType).reduce((sum, item) => sum + (item.count || 0), 0)
  }

  const formatCurrency = (usd: number, currency: 'USD' | 'GBP' = 'GBP') => {
    const rate = currency === 'GBP' ? 0.79 : 1
    const symbol = currency === 'GBP' ? '£' : '$'
    return `${symbol}${(usd * rate).toFixed(4)}`
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Usage & Costs</h1>
          <p className="text-muted-foreground">Monitor your AI feature usage and estimated costs</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
          <TabsList>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
            <TabsTrigger value="90d">90 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Credit Usage Alert */}
      {credits && credits.percentUsed >= 80 && (
        <Alert variant={credits.percentUsed >= 100 ? 'destructive' : 'default'}>
          {credits.percentUsed >= 100 ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          <AlertTitle>
            {credits.percentUsed >= 100 ? 'Credits Exceeded' : 'Approaching Credit Limit'}
          </AlertTitle>
          <AlertDescription>
            {credits.percentUsed >= 100 
              ? `You've used ${credits.creditsUsed} of ${credits.creditsIncluded} included credits. Overage charges: £${credits.overageCharge.toFixed(2)}`
              : `You've used ${credits.percentUsed.toFixed(0)}% of your monthly credits (${credits.creditsUsed}/${credits.creditsIncluded}).`
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Credit Usage Card - Prominent */}
      {credits && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Monthly AI Credits</CardTitle>
                <CardDescription>
                  {credits.tier.charAt(0).toUpperCase() + credits.tier.slice(1)} Plan • {credits.period}
                </CardDescription>
              </div>
              <Badge variant={credits.percentUsed >= 100 ? 'destructive' : credits.percentUsed >= 80 ? 'secondary' : 'default'}>
                {credits.percentUsed >= 100 ? 'Overage' : credits.percentUsed >= 80 ? 'High Usage' : 'Normal'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>{credits.creditsUsed.toLocaleString()} / {credits.creditsIncluded.toLocaleString()} credits used</span>
              <span className="font-medium">{credits.percentUsed.toFixed(1)}%</span>
            </div>
            <Progress value={Math.min(credits.percentUsed, 100)} className="h-3" />
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{credits.creditsRemaining.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Remaining</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{credits.overageCredits.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Overage</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-600">£{credits.overageCharge.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Overage Cost</p>
              </div>
            </div>
            {credits.overageCredits > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Overage rate: £{credits.overageRate}/credit
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalRequests().toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              AI actions this period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(usage?.totalTokens || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Input + output tokens
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Period Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(usage?.totalCostUsd || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Last {period.replace('d', '')} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Est. Monthly</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(calculateEstimatedMonthlyCost())}</div>
            <p className="text-xs text-muted-foreground">
              Projected monthly cost
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Margin Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Profit Margin Analysis</CardTitle>
          <CardDescription>Your AI costs vs subscription revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { tier: 'Starter', revenue: 49, color: 'bg-blue-500' },
              { tier: 'Professional', revenue: 149, color: 'bg-purple-500' },
              { tier: 'Enterprise', revenue: 499, color: 'bg-amber-500' },
            ].map(({ tier, revenue, color }) => {
              const monthlyCost = calculateEstimatedMonthlyCost() * 0.79 // Convert to GBP
              const margin = ((revenue - monthlyCost) / revenue) * 100
              return (
                <div key={tier} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{tier} (£{revenue}/mo)</span>
                    <span className="text-muted-foreground">
                      Cost: £{monthlyCost.toFixed(2)} | Margin: {margin.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={margin} className="h-2" />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Usage by Feature */}
      <Card>
        <CardHeader>
          <CardTitle>Usage by Feature</CardTitle>
          <CardDescription>Breakdown of AI usage by feature type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usage?.byRequestType && Object.entries(usage.byRequestType).map(([type, data]) => {
              const Icon = FEATURE_ICONS[type] || Sparkles
              const name = FEATURE_NAMES[type] || type
              const cost = data.cost || (data.tokens * 0.0000005) // Fallback calculation
              
              return (
                <div key={type} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="text-sm text-muted-foreground">
                        {data.tokens.toLocaleString()} tokens
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(cost)}</p>
                    <Badge variant="secondary" className="text-xs">
                      {((cost / (usage.totalCostUsd || 1)) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              )
            })}

            {(!usage?.byRequestType || Object.keys(usage.byRequestType).length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No AI usage data yet</p>
                <p className="text-sm">Start using AI features to see your usage stats</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cost Breakdown by Provider */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>By Provider</CardTitle>
            <CardDescription>Cost breakdown by AI provider</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {usage?.byProvider && Object.entries(usage.byProvider).map(([provider, data]) => (
                <div key={provider} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={provider === 'openai' ? 'default' : 'secondary'}>
                      {provider}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(data.cost)}</p>
                    <p className="text-xs text-muted-foreground">
                      {data.tokens.toLocaleString()} tokens
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cost Optimization Tips</CardTitle>
            <CardDescription>Ways to reduce your AI costs</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Using GPT-4o-mini for most tasks (cheapest option)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Rate limiting prevents abuse</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Token limits cap response lengths</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500">→</span>
                <span>Consider local AI (LM Studio) for $0 cost</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Your margins are excellent</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Even with heavy usage, AI costs typically stay under 1% of your subscription revenue. 
                The rate limits and model routing we've implemented ensure costs remain predictable.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
