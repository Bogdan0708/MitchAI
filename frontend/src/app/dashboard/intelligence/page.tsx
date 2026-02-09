'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import {
  Brain,
  Bell,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Plus,
  ChevronRight,
  Activity,
  Target,
  BarChart3,
  Users,
  DollarSign,
  Shield,
  Megaphone,
  Eye,
  Settings,
  Play,
  Pause,
} from 'lucide-react'

interface Alert {
  id: string
  alertType: string
  severity: string
  title: string
  message: string
  isRead: boolean
  isResolved: boolean
  createdAt: string
}

interface Insight {
  id: string
  insightType: string
  category: string
  title: string
  description: string
  impact: string
  confidence: number
  suggestedActions: string[]
  isActionable: boolean
}

interface AlertRule {
  id: string
  name: string
  ruleType: string
  isActive: boolean
  triggerCount: number
  lastTriggeredAt?: string
}

interface AutomationRule {
  id: string
  name: string
  description?: string
  triggerType: string
  isActive: boolean
  runCount: number
  successCount: number
}

interface DashboardData {
  alertsSummary: { unread: number; critical: number; warning: number }
  topInsights: Insight[]
  activeAutomations: number
  healthScore: number
  recommendations: string[]
}

export default function IntelligencePage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [alertRules, setAlertRules] = useState<AlertRule[]>([])
  const [automations, setAutomations] = useState<AutomationRule[]>([])
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'insights' | 'automations'>('overview')
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [dashboardRes, alertsRes, insightsRes, rulesRes, automationsRes] = await Promise.all([
        api.getIntelligenceDashboard().catch(() => null),
        api.getAlerts().catch(() => null),
        api.getInsights().catch(() => null),
        api.getAlertRules().catch(() => null),
        api.getAutomationRules().catch(() => null),
      ])

      if (dashboardRes?.data) setDashboard(dashboardRes.data)
      if (Array.isArray(alertsRes?.items)) setAlerts(alertsRes.items)
      if (Array.isArray(insightsRes?.data)) setInsights(insightsRes.data)
      if (Array.isArray(rulesRes?.data)) setAlertRules(rulesRes.data)
      if (Array.isArray(automationsRes?.data)) setAutomations(automationsRes.data)
    } catch (err) {
      setError('Failed to load intelligence data')
      // Set demo data
      setDashboard({
        alertsSummary: { unread: 3, critical: 0, warning: 2 },
        topInsights: [],
        activeAutomations: 5,
        healthScore: 87,
        recommendations: [
          'Consider responding to 3 new reviews to maintain engagement',
          'Temperature check overdue for Walk-in Freezer',
          'Peak hours suggest adding staff on Friday evenings',
        ],
      })
      setAlerts([
        { id: '1', alertType: 'review', severity: 'warning', title: 'New 2-star review', message: 'Customer mentioned slow service on Google', isRead: false, isResolved: false, createdAt: '2026-01-25T09:30:00Z' },
        { id: '2', alertType: 'compliance', severity: 'warning', title: 'Temperature check overdue', message: 'Walk-in Freezer temperature check is 2 hours overdue', isRead: false, isResolved: false, createdAt: '2026-01-25T08:00:00Z' },
        { id: '3', alertType: 'sales', severity: 'info', title: 'Daily revenue milestone', message: 'You\'ve reached $2,500 in sales today!', isRead: true, isResolved: true, createdAt: '2026-01-24T22:00:00Z' },
      ])
      setInsights([
        { id: '1', insightType: 'opportunity', category: 'revenue', title: 'Upsell Opportunity Detected', description: 'Customers ordering burgers rarely add sides. Suggest combo deals to increase average order value.', impact: 'high', confidence: 85, suggestedActions: ['Create burger + fries combo', 'Train staff on upselling'], isActionable: true },
        { id: '2', insightType: 'trend', category: 'customer', title: 'Rising Vegetarian Demand', description: 'Vegetarian menu items have increased 25% in orders this month.', impact: 'medium', confidence: 92, suggestedActions: ['Add more vegetarian options', 'Feature vegetarian specials'], isActionable: true },
        { id: '3', insightType: 'risk', category: 'operations', title: 'Staff Scheduling Gap', description: 'Friday 6-8 PM consistently understaffed based on order volume.', impact: 'high', confidence: 88, suggestedActions: ['Add 1-2 staff for Friday evenings', 'Review scheduling'], isActionable: true },
      ])
      setAlertRules([
        { id: '1', name: 'Low rating alert', ruleType: 'threshold', isActive: true, triggerCount: 12, lastTriggeredAt: '2026-01-25T09:30:00Z' },
        { id: '2', name: 'Temperature out of range', ruleType: 'threshold', isActive: true, triggerCount: 3, lastTriggeredAt: '2026-01-20T14:00:00Z' },
        { id: '3', name: 'Daily revenue milestone', ruleType: 'threshold', isActive: true, triggerCount: 45, lastTriggeredAt: '2026-01-24T22:00:00Z' },
      ])
      setAutomations([
        { id: '1', name: 'Auto-respond to 5-star reviews', description: 'Send thank you response to positive reviews', triggerType: 'event', isActive: true, runCount: 28, successCount: 28 },
        { id: '2', name: 'Daily compliance reminder', description: 'Send morning checklist reminder to staff', triggerType: 'schedule', isActive: true, runCount: 30, successCount: 30 },
        { id: '3', name: 'Low inventory alert', description: 'Alert when menu items are running low', triggerType: 'condition', isActive: false, runCount: 5, successCount: 4 },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerateInsights = async () => {
    try {
      setIsGenerating(true)
      const response = await api.generateInsights()
      const newInsights = response.data?.insights
      if (newInsights && newInsights.length > 0) {
        setInsights(prev => [...newInsights, ...prev])
      }
      // Refresh all data after generating
      await fetchData()
    } catch (err) {
      console.error('Failed to generate insights:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.markAllAlertsRead()
      setAlerts(prev => prev.map(alert => ({ ...alert, isRead: true })))
    } catch (err) {
      console.error('Failed to mark all alerts as read:', err)
    }
  }

  const handleResolveAlert = async (alertId: string) => {
    try {
      await api.resolveAlert(alertId)
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, isResolved: true } : alert
      ))
    } catch (err) {
      console.error('Failed to resolve alert:', err)
    }
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-5 w-5 text-red-500" />
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />
      case 'info': return <Bell className="h-5 w-5 text-blue-500" />
      default: return <Bell className="h-5 w-5 text-gray-500" />
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive">Critical</Badge>
      case 'warning': return <Badge variant="warning">Warning</Badge>
      case 'info': return <Badge variant="secondary">Info</Badge>
      default: return <Badge variant="secondary">{severity}</Badge>
    }
  }

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case 'high': return <Badge variant="destructive">High Impact</Badge>
      case 'medium': return <Badge variant="warning">Medium Impact</Badge>
      case 'low': return <Badge variant="secondary">Low Impact</Badge>
      default: return <Badge variant="secondary">{impact}</Badge>
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'revenue': return <DollarSign className="h-5 w-5 text-green-500" />
      case 'operations': return <Activity className="h-5 w-5 text-blue-500" />
      case 'customer': return <Users className="h-5 w-5 text-purple-500" />
      case 'compliance': return <Shield className="h-5 w-5 text-amber-500" />
      case 'marketing': return <Megaphone className="h-5 w-5 text-pink-500" />
      default: return <Lightbulb className="h-5 w-5 text-amber-500" />
    }
  }

  const getInsightTypeIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return <TrendingUp className="h-5 w-5 text-green-500" />
      case 'risk': return <AlertTriangle className="h-5 w-5 text-red-500" />
      case 'trend': return <BarChart3 className="h-5 w-5 text-blue-500" />
      case 'recommendation': return <Target className="h-5 w-5 text-purple-500" />
      case 'anomaly': return <Activity className="h-5 w-5 text-orange-500" />
      default: return <Lightbulb className="h-5 w-5 text-amber-500" />
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Business Intelligence</h1>
            <p className="text-muted-foreground">Loading intelligence data...</p>
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

  const unreadAlerts = alerts.filter(a => !a.isRead).length
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.isResolved).length
  const activeAutomations = automations.filter(a => a.isActive).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Business Intelligence</h1>
          <p className="text-muted-foreground">
            AI-powered alerts, insights, and automation for your business
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleGenerateInsights} disabled={isGenerating}>
            <Zap className="h-4 w-4 mr-2" />
            {isGenerating ? 'Generating...' : 'Generate Insights'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Health Score</p>
                <p className="text-3xl font-bold text-green-600">{dashboard?.healthScore || 0}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Unread Alerts</p>
                <p className="text-3xl font-bold">{unreadAlerts}</p>
                {criticalAlerts > 0 && <p className="text-sm text-red-500">{criticalAlerts} critical</p>}
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Bell className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Insights</p>
                <p className="text-3xl font-bold">{insights.filter(i => i.isActionable).length}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Lightbulb className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Automations</p>
                <p className="text-3xl font-bold">{activeAutomations}</p>
                <p className="text-sm text-muted-foreground">of {automations.length} active</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['overview', 'alerts', 'insights', 'automations'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Alerts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Latest notifications requiring attention</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('alerts')}>View All</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.slice(0, 4).map((alert) => (
                  <div key={alert.id} className={`flex items-start gap-3 p-3 border rounded-lg ${!alert.isRead ? 'bg-muted/50' : ''}`}>
                    {getSeverityIcon(alert.severity)}
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${!alert.isRead ? '' : 'text-muted-foreground'}`}>{alert.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!alert.isResolved && (
                      <Button variant="ghost" size="sm">View</Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Insights */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Top Insights</CardTitle>
                <CardDescription>AI-powered business recommendations</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('insights')}>View All</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {insights.slice(0, 3).map((insight) => (
                  <div key={insight.id} className="p-3 border rounded-lg">
                    <div className="flex items-start gap-3">
                      {getInsightTypeIcon(insight.insightType)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{insight.title}</p>
                          {getImpactBadge(insight.impact)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="capitalize">{insight.category}</Badge>
                          <span className="text-xs text-muted-foreground">{insight.confidence}% confidence</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Quick Recommendations</CardTitle>
              <CardDescription>Suggested actions based on your data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {dashboard?.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <Target className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm">{rec}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'alerts' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>All Alerts</CardTitle>
              <CardDescription>Notifications and warnings from across your business</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleMarkAllRead}>Mark All Read</Button>
              <Button onClick={() => setActiveTab('rules')}>
                <Settings className="h-4 w-4 mr-2" />
                Alert Rules
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.id} className={`flex items-start gap-4 p-4 border rounded-lg ${!alert.isRead ? 'bg-muted/50 border-primary/20' : ''}`}>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    alert.severity === 'critical' ? 'bg-red-100' :
                    alert.severity === 'warning' ? 'bg-amber-100' : 'bg-blue-100'
                  }`}>
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{alert.title}</p>
                      {!alert.isRead && <Badge variant="outline" className="text-xs">New</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                      <span className="capitalize">{alert.alertType}</span>
                      <span>•</span>
                      <span>{new Date(alert.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(alert.severity)}
                    {alert.isResolved ? (
                      <Badge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>
                    ) : (
                      <Button size="sm" onClick={() => handleResolveAlert(alert.id)}>Resolve</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'insights' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Business Insights</CardTitle>
              <CardDescription>AI-powered analysis and recommendations</CardDescription>
            </div>
            <Button>
              <Zap className="h-4 w-4 mr-2" />
              Generate New Insights
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.map((insight) => (
                <div key={insight.id} className="p-4 border rounded-lg">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                      insight.insightType === 'opportunity' ? 'bg-green-100' :
                      insight.insightType === 'risk' ? 'bg-red-100' :
                      insight.insightType === 'trend' ? 'bg-blue-100' : 'bg-purple-100'
                    }`}>
                      {getInsightTypeIcon(insight.insightType)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{insight.title}</h3>
                          <Badge variant="outline" className="capitalize">{insight.insightType}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {getImpactBadge(insight.impact)}
                          <span className="text-sm text-muted-foreground">{insight.confidence}% confidence</span>
                        </div>
                      </div>
                      <p className="text-muted-foreground mt-2">{insight.description}</p>
                      {insight.suggestedActions.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Suggested Actions:</p>
                          <ul className="space-y-1">
                            {insight.suggestedActions.map((action, i) => (
                              <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-4">
                        <Badge variant="outline" className="capitalize">{insight.category}</Badge>
                        {insight.isActionable && <Badge variant="success">Actionable</Badge>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'automations' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Alert Rules */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Alert Rules</CardTitle>
                <CardDescription>Conditions that trigger notifications</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alertRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${rule.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                        <Bell className={`h-5 w-5 ${rule.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="capitalize">{rule.ruleType}</span>
                          <span>•</span>
                          <span>Triggered {rule.triggerCount} times</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={rule.isActive ? 'success' : 'secondary'}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button variant="ghost" size="icon">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Automation Rules */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Automation Rules</CardTitle>
                <CardDescription>Automated workflows and actions</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Automation
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {automations.map((auto) => (
                  <div key={auto.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${auto.isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <Zap className={`h-5 w-5 ${auto.isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className="font-medium">{auto.name}</p>
                        {auto.description && (
                          <p className="text-sm text-muted-foreground">{auto.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <span className="capitalize">{auto.triggerType}</span>
                          <span>•</span>
                          <span>{auto.successCount}/{auto.runCount} successful runs</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon">
                        {auto.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {error && (
        <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          Note: Using demo data. {error}
        </div>
      )}
    </div>
  )
}
