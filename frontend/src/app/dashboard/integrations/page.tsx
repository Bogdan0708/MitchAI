'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Check,
  X,
  ExternalLink,
  RefreshCw,
  Settings,
  Zap,
  Star,
  MessageSquare,
  ShoppingBag,
  CreditCard,
  Bot,
  Globe,
  Phone,
  Mail,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Integration {
  id: string
  name: string
  description: string
  category: string
  icon: React.ReactNode
  iconBg: string
  status: 'connected' | 'disconnected' | 'coming_soon' | 'error'
  lastSync?: string
  stats?: Record<string, string | number>
  features: string[]
}

// Integration categories
const categories = [
  { id: 'reviews', name: 'Review Platforms', icon: <Star className="h-4 w-4" /> },
  { id: 'delivery', name: 'Delivery & Orders', icon: <ShoppingBag className="h-4 w-4" /> },
  { id: 'pos', name: 'POS Systems', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'communication', name: 'Communication', icon: <MessageSquare className="h-4 w-4" /> },
  { id: 'ai', name: 'AI Providers', icon: <Bot className="h-4 w-4" /> },
]

// Google logo SVG component
const GoogleLogo = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

// Integration definitions
const integrations: Integration[] = [
  // Review Platforms
  {
    id: 'google',
    name: 'Google Business Profile',
    description: 'Import and respond to Google reviews automatically',
    category: 'reviews',
    icon: <GoogleLogo />,
    iconBg: 'bg-white shadow',
    status: 'connected',
    lastSync: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    stats: { reviews: 156, avgRating: 4.6, responseRate: '92%' },
    features: ['Auto-import reviews', 'AI response suggestions', 'Sentiment analysis', 'Rating trends'],
  },
  {
    id: 'yelp',
    name: 'Yelp for Business',
    description: 'Monitor and respond to Yelp reviews',
    category: 'reviews',
    icon: <span className="text-2xl">🔴</span>,
    iconBg: 'bg-red-50',
    status: 'disconnected',
    features: ['Review monitoring', 'Response templates', 'Competitor analysis', 'Photo management'],
  },
  {
    id: 'tripadvisor',
    name: 'TripAdvisor',
    description: 'Connect to TripAdvisor for tourism insights',
    category: 'reviews',
    icon: <span className="text-2xl">🦉</span>,
    iconBg: 'bg-green-50',
    status: 'coming_soon',
    features: ['Traveler reviews', 'Ranking insights', 'Photo gallery', 'Award tracking'],
  },
  {
    id: 'facebook',
    name: 'Facebook & Instagram',
    description: 'Manage social reviews and messages',
    category: 'reviews',
    icon: <span className="text-2xl">📘</span>,
    iconBg: 'bg-blue-50',
    status: 'disconnected',
    features: ['Page reviews', 'Messenger inbox', 'Post engagement', 'Story insights'],
  },

  // Delivery Platforms
  {
    id: 'doordash',
    name: 'DoorDash',
    description: 'Sync delivery orders and customer feedback',
    category: 'delivery',
    icon: <span className="text-2xl">🚪</span>,
    iconBg: 'bg-red-50',
    status: 'coming_soon',
    features: ['Order sync', 'Menu management', 'Driver tracking', 'Customer feedback'],
  },
  {
    id: 'ubereats',
    name: 'Uber Eats',
    description: 'Manage Uber Eats orders and menu',
    category: 'delivery',
    icon: <span className="text-2xl">🚗</span>,
    iconBg: 'bg-green-50',
    status: 'coming_soon',
    features: ['Order management', 'Menu sync', 'Promotions', 'Analytics'],
  },
  {
    id: 'grubhub',
    name: 'Grubhub',
    description: 'Integrate Grubhub orders',
    category: 'delivery',
    icon: <span className="text-2xl">🍔</span>,
    iconBg: 'bg-orange-50',
    status: 'coming_soon',
    features: ['Order sync', 'Menu editor', 'Driver dispatch', 'Reports'],
  },

  // POS Systems
  {
    id: 'square',
    name: 'Square',
    description: 'Connect Square POS for unified reporting',
    category: 'pos',
    icon: <span className="text-2xl">⬛</span>,
    iconBg: 'bg-black/5',
    status: 'disconnected',
    features: ['Sales sync', 'Inventory', 'Customer data', 'Payment reports'],
  },
  {
    id: 'toast',
    name: 'Toast POS',
    description: 'Integrate with Toast restaurant POS',
    category: 'pos',
    icon: <span className="text-2xl">🍞</span>,
    iconBg: 'bg-orange-50',
    status: 'coming_soon',
    features: ['Order sync', 'Menu management', 'Staff scheduling', 'Reports'],
  },
  {
    id: 'clover',
    name: 'Clover',
    description: 'Connect Clover for payment processing',
    category: 'pos',
    icon: <span className="text-2xl">🍀</span>,
    iconBg: 'bg-green-50',
    status: 'coming_soon',
    features: ['Payment sync', 'Inventory', 'Employee management', 'Reporting'],
  },

  // Communication
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Enable WhatsApp ordering and support',
    category: 'communication',
    icon: <span className="text-2xl">💬</span>,
    iconBg: 'bg-green-50',
    status: 'connected',
    lastSync: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    stats: { conversations: 42, responseTime: '2.3min' },
    features: ['Chat support', 'Order taking', 'Automated replies', 'Broadcast messages'],
  },
  {
    id: 'twilio',
    name: 'Twilio SMS',
    description: 'Send SMS notifications and reminders',
    category: 'communication',
    icon: <span className="text-2xl">📱</span>,
    iconBg: 'bg-red-50',
    status: 'disconnected',
    features: ['Order updates', 'Reservation reminders', 'Marketing SMS', '2-way messaging'],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid Email',
    description: 'Transactional and marketing emails',
    category: 'communication',
    icon: <span className="text-2xl">📧</span>,
    iconBg: 'bg-blue-50',
    status: 'connected',
    lastSync: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    stats: { emailsSent: 1240, openRate: '34%' },
    features: ['Order confirmations', 'Marketing campaigns', 'Templates', 'Analytics'],
  },

  // AI Providers
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models for chat and content generation',
    category: 'ai',
    icon: <span className="text-2xl">🤖</span>,
    iconBg: 'bg-emerald-50',
    status: 'connected',
    stats: { requests: '12.4K', cost: '$24.50' },
    features: ['GPT-4o', 'Chat completions', 'Embeddings', 'Whisper transcription'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Claude models for nuanced responses',
    category: 'ai',
    icon: <span className="text-2xl">🧠</span>,
    iconBg: 'bg-orange-50',
    status: 'connected',
    stats: { requests: '8.2K', cost: '$18.30' },
    features: ['Claude 3 Opus', 'Claude 3 Haiku', 'Long context', 'Safe responses'],
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (Local)',
    description: 'Run AI models locally for cost savings',
    category: 'ai',
    icon: <span className="text-2xl">💻</span>,
    iconBg: 'bg-purple-50',
    status: 'connected',
    stats: { requests: '45.8K', cost: '$0' },
    features: ['Zero API costs', 'Data privacy', 'Custom models', 'Offline capable'],
  },
]

export default function IntegrationsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [showConfigModal, setShowConfigModal] = useState<string | null>(null)
  const [localIntegrations, setLocalIntegrations] = useState(integrations)

  // Filter integrations
  const filteredIntegrations = localIntegrations.filter((integration) => {
    const matchesCategory = !selectedCategory || integration.category === selectedCategory
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          integration.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  // Group by category
  const groupedIntegrations = categories.map((category) => ({
    ...category,
    integrations: filteredIntegrations.filter((i) => i.category === category.id),
  })).filter((group) => group.integrations.length > 0)

  // Stats
  const stats = {
    connected: localIntegrations.filter(i => i.status === 'connected').length,
    available: localIntegrations.filter(i => i.status !== 'coming_soon').length,
    comingSoon: localIntegrations.filter(i => i.status === 'coming_soon').length,
  }

  const handleConnect = async (id: string) => {
    setConnectingId(id)
    // Simulate connection
    await new Promise(resolve => setTimeout(resolve, 1500))
    setLocalIntegrations(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'connected' as const, lastSync: new Date().toISOString() } : i
    ))
    setConnectingId(null)
  }

  const handleDisconnect = async (id: string) => {
    setLocalIntegrations(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'disconnected' as const, lastSync: undefined, stats: undefined } : i
    ))
  }

  const handleSync = async (id: string) => {
    setSyncingId(id)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setLocalIntegrations(prev => prev.map(i =>
      i.id === id ? { ...i, lastSync: new Date().toISOString() } : i
    ))
    setSyncingId(null)
  }

  const getStatusBadge = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Connected</Badge>
      case 'disconnected':
        return <Badge variant="secondary">Not Connected</Badge>
      case 'coming_soon':
        return <Badge variant="outline" className="text-muted-foreground">Coming Soon</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Integrations Hub</h1>
          <p className="text-muted-foreground">
            Connect your restaurant to external platforms and services
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-medium">{stats.connected}</span>
              <span className="text-muted-foreground">connected</span>
            </div>
            <span className="text-muted-foreground">•</span>
            <div className="flex items-center gap-1">
              <Globe className="h-4 w-4 text-blue-500" />
              <span className="font-medium">{stats.available}</span>
              <span className="text-muted-foreground">available</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          All ({localIntegrations.length})
        </Button>
        {categories.map((category) => {
          const count = localIntegrations.filter(i => i.category === category.id).length
          return (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="gap-2"
            >
              {category.icon}
              {category.name} ({count})
            </Button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search integrations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Integrations by Category */}
      {groupedIntegrations.map((group) => (
        <div key={group.id} className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {group.icon}
            {group.name}
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.integrations.map((integration) => (
              <Card
                key={integration.id}
                className={cn(
                  'relative overflow-hidden transition-all hover:shadow-md',
                  integration.status === 'coming_soon' && 'opacity-60'
                )}
              >
                {integration.status === 'connected' && (
                  <div className="absolute top-0 right-0 w-16 h-16">
                    <div className="absolute transform rotate-45 bg-green-500 text-white text-[10px] font-medium py-0.5 right-[-35px] top-[12px] w-[100px] text-center">
                      Active
                    </div>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className={cn('h-12 w-12 rounded-lg flex items-center justify-center', integration.iconBg)}>
                      {integration.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                      </div>
                      <CardDescription className="line-clamp-1">{integration.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pb-3">
                  {/* Stats for connected integrations */}
                  {integration.status === 'connected' && integration.stats && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {Object.entries(integration.stats).map(([key, value]) => (
                        <div key={key} className="text-center p-2 bg-muted rounded">
                          <p className="text-sm font-bold">{value}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Features */}
                  <div className="flex flex-wrap gap-1">
                    {integration.features.slice(0, 3).map((feature, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {feature}
                      </Badge>
                    ))}
                    {integration.features.length > 3 && (
                      <Badge variant="secondary" className="text-[10px]">
                        +{integration.features.length - 3} more
                      </Badge>
                    )}
                  </div>

                  {/* Last sync */}
                  {integration.lastSync && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last synced: {new Date(integration.lastSync).toLocaleString()}
                    </p>
                  )}
                </CardContent>

                <CardFooter className="pt-0">
                  {integration.status === 'connected' ? (
                    <div className="flex gap-2 w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleSync(integration.id)}
                        disabled={syncingId === integration.id}
                      >
                        {syncingId === integration.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Sync
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setShowConfigModal(integration.id)}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Settings
                      </Button>
                    </div>
                  ) : integration.status === 'disconnected' ? (
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => handleConnect(integration.id)}
                      disabled={connectingId === integration.id}
                    >
                      {connectingId === integration.id ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3 mr-1" />
                          Connect
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" size="sm" disabled>
                      Coming Soon
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Empty State */}
      {filteredIntegrations.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <Globe className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium">No integrations found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your search or filter criteria
            </p>
          </CardContent>
        </Card>
      )}

      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Integration Settings</CardTitle>
              <CardDescription>
                Configure {localIntegrations.find(i => i.id === showConfigModal)?.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input type="password" value="••••••••••••••••" readOnly />
              </div>
              <div className="space-y-2">
                <Label>Sync Frequency</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background text-foreground dark:bg-gray-800 dark:border-gray-600">
                  <option>Every 15 minutes</option>
                  <option>Every hour</option>
                  <option>Every 6 hours</option>
                  <option>Daily</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Auto-respond to reviews</p>
                  <p className="text-xs text-muted-foreground">AI will draft responses automatically</p>
                </div>
                <input type="checkbox" className="h-4 w-4" defaultChecked />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  handleDisconnect(showConfigModal)
                  setShowConfigModal(null)
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
              <Button onClick={() => setShowConfigModal(null)}>
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
