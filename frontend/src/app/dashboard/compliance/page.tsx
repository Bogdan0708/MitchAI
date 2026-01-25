'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import {
  ClipboardCheck,
  Thermometer,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  ChevronRight,
  Settings,
  ThermometerSnowflake,
  ThermometerSun,
  FileText,
  Wrench,
} from 'lucide-react'

interface ComplianceDashboard {
  complianceScore: number
  checksToday: number
  checksDue: number
  openActions: number
  criticalAlerts: number
  recentChecks: any[]
  equipmentAlerts: { equipment: any; issue: string }[]
}

interface Template {
  id: string
  name: string
  category: string
  frequency: string
  isActive: boolean
}

interface Equipment {
  id: string
  name: string
  equipmentType: string
  status: string
  tempLowerLimit?: number
  tempUpperLimit?: number
}

interface CorrectiveAction {
  id: string
  title: string
  severity: string
  status: string
  dueDate?: string
  assignedToName?: string
}

export default function CompliancePage() {
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [actions, setActions] = useState<CorrectiveAction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'checks' | 'equipment' | 'actions'>('overview')
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [dashboardRes, templatesRes, equipmentRes, actionsRes] = await Promise.all([
        api.getComplianceDashboard().catch(() => null),
        api.getComplianceTemplates().catch(() => null),
        api.getEquipment().catch(() => null),
        api.getCorrectiveActions().catch(() => null),
      ])

      if (dashboardRes?.data) setDashboard(dashboardRes.data)
      if (Array.isArray(templatesRes?.data)) setTemplates(templatesRes.data)
      if (Array.isArray(equipmentRes?.data)) setEquipment(equipmentRes.data)
      if (Array.isArray(actionsRes?.items)) setActions(actionsRes.items)
    } catch (err) {
      setError('Failed to load compliance data')
      // Set demo data
      setDashboard({
        complianceScore: 94,
        checksToday: 12,
        checksDue: 3,
        openActions: 2,
        criticalAlerts: 0,
        recentChecks: [],
        equipmentAlerts: [],
      })
      setTemplates([
        { id: '1', name: 'Morning Temperature Check', category: 'temperature', frequency: 'daily', isActive: true },
        { id: '2', name: 'Kitchen Cleaning Checklist', category: 'cleaning', frequency: 'daily', isActive: true },
        { id: '3', name: 'Delivery Receiving Log', category: 'receiving', frequency: 'on_demand', isActive: true },
        { id: '4', name: 'Allergen Station Check', category: 'allergen', frequency: 'daily', isActive: true },
      ])
      setEquipment([
        { id: '1', name: 'Walk-in Fridge #1', equipmentType: 'fridge', status: 'active', tempLowerLimit: 1, tempUpperLimit: 4 },
        { id: '2', name: 'Walk-in Freezer', equipmentType: 'freezer', status: 'active', tempLowerLimit: -20, tempUpperLimit: -15 },
        { id: '3', name: 'Prep Station Fridge', equipmentType: 'fridge', status: 'active', tempLowerLimit: 1, tempUpperLimit: 4 },
        { id: '4', name: 'Hot Holding Unit', equipmentType: 'hot_holding', status: 'active', tempLowerLimit: 60, tempUpperLimit: 75 },
      ])
      setActions([
        { id: '1', title: 'Recalibrate probe thermometer', severity: 'medium', status: 'in_progress', dueDate: '2026-01-27', assignedToName: 'John Smith' },
        { id: '2', title: 'Deep clean freezer unit', severity: 'low', status: 'open', dueDate: '2026-01-30', assignedToName: 'Jane Doe' },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive'
      case 'high': return 'destructive'
      case 'medium': return 'warning'
      case 'low': return 'secondary'
      default: return 'secondary'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'destructive'
      case 'in_progress': return 'warning'
      case 'resolved': return 'success'
      case 'verified': return 'success'
      default: return 'secondary'
    }
  }

  const getEquipmentIcon = (type: string) => {
    switch (type) {
      case 'fridge': return <ThermometerSnowflake className="h-5 w-5 text-blue-500" />
      case 'freezer': return <ThermometerSnowflake className="h-5 w-5 text-cyan-500" />
      case 'hot_holding': return <ThermometerSun className="h-5 w-5 text-orange-500" />
      default: return <Thermometer className="h-5 w-5 text-gray-500" />
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Food Safety & Compliance</h1>
            <p className="text-muted-foreground">Loading compliance data...</p>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Food Safety & Compliance</h1>
          <p className="text-muted-foreground">
            Manage food safety checks, temperature logs, and HACCP compliance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Check
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Compliance Score</p>
                <p className="text-3xl font-bold text-green-600">{dashboard?.complianceScore || 0}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Checks Today</p>
                <p className="text-3xl font-bold">{dashboard?.checksToday || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <ClipboardCheck className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Checks Due</p>
                <p className="text-3xl font-bold text-amber-600">{dashboard?.checksDue || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Open Actions</p>
                <p className="text-3xl font-bold text-orange-600">{dashboard?.openActions || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <Wrench className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Critical Alerts</p>
                <p className="text-3xl font-bold text-red-600">{dashboard?.criticalAlerts || 0}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['overview', 'checks', 'equipment', 'actions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'checks' ? 'Check Templates' : tab === 'actions' ? 'Corrective Actions' : tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common compliance tasks</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button variant="outline" className="justify-start h-auto py-3">
                <Thermometer className="h-5 w-5 mr-3 text-blue-500" />
                <div className="text-left">
                  <div className="font-medium">Log Temperature</div>
                  <div className="text-sm text-muted-foreground">Record equipment temperatures</div>
                </div>
                <ChevronRight className="h-5 w-5 ml-auto" />
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3">
                <ClipboardCheck className="h-5 w-5 mr-3 text-green-500" />
                <div className="text-left">
                  <div className="font-medium">Complete Check</div>
                  <div className="text-sm text-muted-foreground">Run a compliance checklist</div>
                </div>
                <ChevronRight className="h-5 w-5 ml-auto" />
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3">
                <FileText className="h-5 w-5 mr-3 text-purple-500" />
                <div className="text-left">
                  <div className="font-medium">View HACCP Plan</div>
                  <div className="text-sm text-muted-foreground">Review critical control points</div>
                </div>
                <ChevronRight className="h-5 w-5 ml-auto" />
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3">
                <AlertTriangle className="h-5 w-5 mr-3 text-amber-500" />
                <div className="text-left">
                  <div className="font-medium">Report Issue</div>
                  <div className="text-sm text-muted-foreground">Log a corrective action</div>
                </div>
                <ChevronRight className="h-5 w-5 ml-auto" />
              </Button>
            </CardContent>
          </Card>

          {/* Equipment Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Equipment Status</CardTitle>
                <CardDescription>Temperature-monitored equipment</CardDescription>
              </div>
              <Button variant="ghost" size="sm">View All</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {equipment.slice(0, 4).map((eq) => (
                  <div key={eq.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getEquipmentIcon(eq.equipmentType)}
                      <div>
                        <p className="font-medium">{eq.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {eq.tempLowerLimit}°C - {eq.tempUpperLimit}°C
                        </p>
                      </div>
                    </div>
                    <Badge variant={eq.status === 'active' ? 'success' : 'warning'}>
                      {eq.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'checks' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Check Templates</CardTitle>
              <CardDescription>Compliance checklists and templates</CardDescription>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ClipboardCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{template.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="capitalize">{template.category}</Badge>
                        <span className="text-sm text-muted-foreground capitalize">{template.frequency.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={template.isActive ? 'success' : 'secondary'}>
                      {template.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button size="sm">Run Check</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'equipment' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Equipment Registry</CardTitle>
              <CardDescription>Manage temperature-monitored equipment</CardDescription>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Equipment
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {equipment.map((eq) => (
                <Card key={eq.id} className="relative overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {getEquipmentIcon(eq.equipmentType)}
                        <div>
                          <p className="font-medium">{eq.name}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {eq.equipmentType.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <Badge variant={eq.status === 'active' ? 'success' : eq.status === 'maintenance' ? 'warning' : 'secondary'}>
                        {eq.status}
                      </Badge>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Temp Range</span>
                        <span className="font-medium">{eq.tempLowerLimit}°C - {eq.tempUpperLimit}°C</span>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">Log Temp</Button>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'actions' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Corrective Actions</CardTitle>
              <CardDescription>Track and resolve compliance issues</CardDescription>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Action
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {actions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p className="font-medium">No open corrective actions</p>
                  <p className="text-sm">Great job maintaining compliance!</p>
                </div>
              ) : (
                actions.map((action) => (
                  <div key={action.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        action.severity === 'critical' ? 'bg-red-100' :
                        action.severity === 'high' ? 'bg-orange-100' :
                        action.severity === 'medium' ? 'bg-amber-100' : 'bg-gray-100'
                      }`}>
                        <AlertTriangle className={`h-5 w-5 ${
                          action.severity === 'critical' ? 'text-red-600' :
                          action.severity === 'high' ? 'text-orange-600' :
                          action.severity === 'medium' ? 'text-amber-600' : 'text-gray-600'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium">{action.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          {action.assignedToName && <span>Assigned to {action.assignedToName}</span>}
                          {action.dueDate && <span>• Due {new Date(action.dueDate).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getSeverityColor(action.severity) as any}>{action.severity}</Badge>
                      <Badge variant={getStatusColor(action.status) as any}>{action.status.replace('_', ' ')}</Badge>
                      <Button size="sm">View</Button>
                    </div>
                  </div>
                ))
              )}
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
