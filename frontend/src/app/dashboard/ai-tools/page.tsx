'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Cpu, Activity, Zap, ChefHat, MessageSquare, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { AIMenuGenerator } from '@/components/dashboard/ai-menu-generator'
import { AIReviewResponder } from '@/components/dashboard/ai-review-responder'
import { AIContentGenerator } from '@/components/dashboard/ai-content-generator'

type ActiveTool = 'menu' | 'review' | 'content'

interface AIHealth {
  healthy: boolean
  providers: Record<string, boolean>
}

interface AIUsage {
  period: string
  totals: { totalRequests: number; totalCredits: number }
  byTask: Record<string, { requests: number; credits: number }>
}

export default function AIToolsPage() {
  const [activeTool, setActiveTool] = useState<ActiveTool>('review')
  const [health, setHealth] = useState<AIHealth | null>(null)
  const [usage, setUsage] = useState<AIUsage | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [healthRes, usageRes] = await Promise.all([
          api.getAIHealth().catch(() => null),
          api.getAIUsage('30d').catch(() => null),
        ])
        
        if (healthRes?.data) setHealth(healthRes.data)
        if (usageRes?.data) setUsage(usageRes.data)
      } catch (err) {
        console.error('Failed to fetch AI data:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const tools = [
    {
      id: 'review' as const,
      label: 'Review Responder',
      description: 'Generate professional responses to customer reviews',
      icon: MessageSquare,
      color: 'bg-blue-500',
    },
    {
      id: 'menu' as const,
      label: 'Menu Descriptions',
      description: 'Create appetizing menu item descriptions',
      icon: ChefHat,
      color: 'bg-amber-500',
    },
    {
      id: 'content' as const,
      label: 'Content Generator',
      description: 'Create social posts, emails, and promos',
      icon: FileText,
      color: 'bg-purple-500',
    },
  ]

  const activeProviders = health?.providers
    ? Object.entries(health.providers).filter(([, v]) => v).map(([k]) => k)
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Tools
          </h1>
          <p className="text-muted-foreground">
            Powered by multiple AI providers for the best results
          </p>
        </div>
        {health && (
          <div className="flex items-center gap-2">
            <div className={cn(
              'h-2 w-2 rounded-full',
              health.healthy ? 'bg-green-500' : 'bg-red-500'
            )} />
            <span className="text-sm text-muted-foreground">
              {health.healthy ? 'AI Online' : 'AI Offline'}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-sm">Requests (30d)</span>
            </div>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : usage?.totals.totalRequests || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="h-4 w-4" />
              <span className="text-sm">Credits Used</span>
            </div>
            <div className="text-2xl font-bold">
              {isLoading ? '...' : usage?.totals.totalCredits || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Cpu className="h-4 w-4" />
              <span className="text-sm">Active Providers</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {isLoading ? (
                <span className="text-sm">Loading...</span>
              ) : activeProviders.length > 0 ? (
                activeProviders.map((provider) => (
                  <Badge key={provider} variant="secondary" className="capitalize">
                    {provider}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No providers available</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tool Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={cn(
                'p-4 rounded-lg border text-left transition-all',
                activeTool === tool.id
                  ? 'border-primary bg-primary/5 ring-2 ring-primary'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={cn('p-2 rounded-lg text-white', tool.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="font-semibold">{tool.label}</span>
              </div>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
            </button>
          )
        })}
      </div>

      {/* Active Tool */}
      <div className="mt-6">
        {activeTool === 'review' && <AIReviewResponder />}
        {activeTool === 'menu' && <AIMenuGenerator />}
        {activeTool === 'content' && <AIContentGenerator />}
      </div>

      {/* Usage Breakdown */}
      {usage && Object.keys(usage.byTask).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Usage by Task (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(usage.byTask).map(([task, data]) => (
                <div key={task} className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm text-muted-foreground capitalize mb-1">
                    {task.replace('_', ' ')}
                  </div>
                  <div className="text-lg font-semibold">{data.requests} requests</div>
                  {data.credits > 0 && (
                    <div className="text-xs text-muted-foreground">{data.credits} credits</div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
