'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bot, Settings, MessageSquare, Zap, Play, Pause, Save, Plus, Trash2,
  Loader2, AlertCircle, CheckCircle, Send, Globe, Phone, Clock,
  Brain, Sparkles, Shield, Languages, ChevronRight, RefreshCw,
  ExternalLink, Copy, Eye, EyeOff
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { api, TenantAgent, AgentStats, AgentCapabilities, CreateAgentInput } from '@/lib/api'

const tabs = [
  { id: 'overview', label: 'Overview', icon: Bot },
  { id: 'config', label: 'Configuration', icon: Settings },
  { id: 'knowledge', label: 'Knowledge', icon: Brain },
  { id: 'channels', label: 'Channels', icon: MessageSquare },
]

const modelOptions = [
  { value: 'auto', label: 'Auto (Best Available)', description: 'Automatically selects the best model' },
  { value: 'local', label: 'Local LLM', description: 'Free, fast, runs on your infrastructure' },
  { value: 'anthropic', label: 'Claude (Anthropic)', description: 'High quality, cloud-based' },
  { value: 'openai', label: 'GPT (OpenAI)', description: 'Versatile, cloud-based' },
]

const defaultSystemPrompt = `You are a helpful restaurant assistant for {restaurant_name}. You can help customers with:
- Menu information and recommendations
- Opening hours and location
- General questions about the restaurant

Always be friendly, professional, and helpful. If you cannot help with something, politely explain why and offer to connect them with staff.`

export default function AgentPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [agent, setAgent] = useState<TenantAgent | null>(null)
  const [stats, setStats] = useState<AgentStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<CreateAgentInput>({
    name: '',
    system_prompt: defaultSystemPrompt,
    model_preference: 'auto',
    temperature: 0.7,
    max_tokens: 1024,
    menu_context_enabled: true,
    capabilities: {
      can_view_menu: true,
      can_view_hours: true,
      can_handle_reservations: false,
      can_process_orders: false,
      can_access_loyalty: false,
      languages: ['en'],
    },
    custom_knowledge: {
      faqs: [],
      policies: {},
      custom_instructions: '',
    },
  })

  // Channel credentials
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramUsername, setTelegramUsername] = useState('')
  const [showTelegramToken, setShowTelegramToken] = useState(false)
  const [isConfiguringChannel, setIsConfiguringChannel] = useState(false)

  // FAQ editor
  const [newFaqQuestion, setNewFaqQuestion] = useState('')
  const [newFaqAnswer, setNewFaqAnswer] = useState('')

  const fetchAgent = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await api.getAgent() as unknown as { agent?: TenantAgent; data?: { agent?: TenantAgent } }
      // Handle both direct response { agent } and wrapped { data: { agent } }
      const agentData = response.agent || response.data?.agent
      if (agentData) {
        setAgent(agentData)
        setFormData({
          name: agentData.name,
          system_prompt: agentData.system_prompt || defaultSystemPrompt,
          model_preference: agentData.model_preference,
          temperature: agentData.temperature,
          max_tokens: agentData.max_tokens,
          menu_context_enabled: agentData.menu_context_enabled,
          capabilities: agentData.capabilities,
          custom_knowledge: agentData.custom_knowledge || { faqs: [], policies: {}, custom_instructions: '' },
        })
        if (agentData.telegram_bot_username) {
          setTelegramUsername(agentData.telegram_bot_username)
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load agent'
      if (message.includes('404') || message.includes('not configured')) {
        // No agent yet - that's okay
        setAgent(null)
      } else {
        setError(message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    if (!agent) return
    try {
      const response = await api.getAgentStats() as unknown as { stats?: AgentStats; data?: { stats?: AgentStats } }
      const statsData = response.stats || response.data?.stats
      if (statsData) {
        setStats(statsData)
      }
    } catch {
      // Stats not critical
    }
  }, [agent])

  useEffect(() => {
    fetchAgent()
  }, [fetchAgent])

  useEffect(() => {
    if (agent) {
      fetchStats()
    }
  }, [agent, fetchStats])

  const handleCreateAgent = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const response = await api.createAgent(formData) as unknown as { agent?: TenantAgent; data?: { agent?: TenantAgent } }
      const agentData = response.agent || response.data?.agent
      if (agentData) {
        setAgent(agentData)
        setSuccess('Agent created successfully!')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create agent'
      // If 409, agent exists - refetch it
      if (message.includes('409') || message.includes('already exists')) {
        await fetchAgent()
        return
      }
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateAgent = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const response = await api.updateAgent(formData) as unknown as { agent?: TenantAgent; data?: { agent?: TenantAgent } }
      const agentData = response.agent || response.data?.agent
      if (agentData) {
        setAgent(agentData)
        setSuccess('Agent updated successfully!')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update agent')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleAgent = async () => {
    if (!agent) return
    setIsToggling(true)
    setError(null)
    try {
      const response = agent.status === 'active' 
        ? await api.stopAgent() as unknown as { agent?: TenantAgent; message?: string; data?: { agent?: TenantAgent; message?: string } }
        : await api.startAgent() as unknown as { agent?: TenantAgent; message?: string; data?: { agent?: TenantAgent; message?: string } }
      const agentData = response.agent || response.data?.agent
      if (agentData) {
        setAgent(agentData)
        setSuccess(response.message || response.data?.message || 'Agent status updated!')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to toggle agent')
    } finally {
      setIsToggling(false)
    }
  }

  const handleConfigureTelegram = async () => {
    if (!telegramToken) {
      setError('Please enter a Telegram bot token')
      return
    }
    setIsConfiguringChannel(true)
    setError(null)
    try {
      const response = await api.configureAgentChannel('telegram', {
        telegram_bot_token: telegramToken,
        telegram_bot_username: telegramUsername,
      })
      if (response.data?.success) {
        setSuccess('Telegram configured successfully!')
        setTelegramToken('')
        fetchAgent() // Refresh to get updated has_telegram status
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to configure Telegram')
    } finally {
      setIsConfiguringChannel(false)
    }
  }

  const handleAddFaq = () => {
    if (!newFaqQuestion.trim() || !newFaqAnswer.trim()) return
    setFormData(prev => ({
      ...prev,
      custom_knowledge: {
        ...prev.custom_knowledge,
        faqs: [...(prev.custom_knowledge?.faqs || []), { question: newFaqQuestion, answer: newFaqAnswer }],
      },
    }))
    setNewFaqQuestion('')
    setNewFaqAnswer('')
  }

  const handleRemoveFaq = (index: number) => {
    setFormData(prev => ({
      ...prev,
      custom_knowledge: {
        ...prev.custom_knowledge,
        faqs: prev.custom_knowledge?.faqs?.filter((_, i) => i !== index) || [],
      },
    }))
  }

  const updateCapability = (key: keyof AgentCapabilities, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      capabilities: {
        ...prev.capabilities,
        [key]: value,
      },
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Agent</h1>
          <p className="text-muted-foreground">
            Configure your restaurant&apos;s AI assistant
          </p>
        </div>
        {agent && (
          <div className="flex items-center gap-3">
            <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className="gap-1">
              {agent.status === 'active' ? (
                <><CheckCircle className="h-3 w-3" /> Active</>
              ) : (
                <><Pause className="h-3 w-3" /> Inactive</>
              )}
            </Badge>
            <Button
              variant={agent.status === 'active' ? 'outline' : 'default'}
              onClick={handleToggleAgent}
              disabled={isToggling}
            >
              {isToggling ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : agent.status === 'active' ? (
                <Pause className="h-4 w-4 mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {agent.status === 'active' ? 'Stop Agent' : 'Start Agent'}
            </Button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* No Agent State */}
      {!agent && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No AI Agent Configured</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Create an AI agent to handle customer inquiries via web chat, Telegram, or WhatsApp.
              </p>
              <Button onClick={handleCreateAgent} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Create AI Agent
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Management */}
      {agent && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 border-b">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Stats Cards */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Messages Today</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.messages_today || 0}</div>
                  <p className="text-xs text-muted-foreground">of {stats?.messages_limit || 1000} limit</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Conversations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.active_conversations || 0}</div>
                  <p className="text-xs text-muted-foreground">{stats?.total_conversations || 0} total</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats?.avg_response_time_ms ? `${(stats.avg_response_time_ms / 1000).toFixed(1)}s` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">this session</p>
                </CardContent>
              </Card>

              {/* Agent Info */}
              <Card className="md:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    {agent.name}
                  </CardTitle>
                  <CardDescription>
                    Created {new Date(agent.created_at).toLocaleDateString()}
                    {agent.last_active_at && ` • Last active ${new Date(agent.last_active_at).toLocaleString()}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Brain className="h-3 w-3" />
                      {modelOptions.find(m => m.value === agent.model_preference)?.label || agent.model_preference}
                    </Badge>
                    {agent.has_telegram && (
                      <Badge variant="outline" className="gap-1 bg-blue-50">
                        <Send className="h-3 w-3" />
                        Telegram: @{agent.telegram_bot_username}
                      </Badge>
                    )}
                    {agent.has_whatsapp && (
                      <Badge variant="outline" className="gap-1 bg-green-50">
                        <Phone className="h-3 w-3" />
                        WhatsApp Connected
                      </Badge>
                    )}
                    {agent.menu_context_enabled && (
                      <Badge variant="outline" className="gap-1">
                        <Sparkles className="h-3 w-3" />
                        Menu Context
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Configuration Tab */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Agent Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Restaurant Assistant"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model">AI Model</Label>
                      <select
                        id="model"
                        value={formData.model_preference}
                        onChange={(e) => setFormData(prev => ({ ...prev, model_preference: e.target.value as CreateAgentInput['model_preference'] }))}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      >
                        {modelOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="prompt">System Prompt</Label>
                    <textarea
                      id="prompt"
                      value={formData.system_prompt}
                      onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
                      rows={6}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background resize-none"
                      placeholder="Instructions for the AI agent..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {'{restaurant_name}'} to insert your business name automatically.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="temperature">Temperature: {formData.temperature}</Label>
                      <input
                        id="temperature"
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.temperature}
                        onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">Lower = more focused, Higher = more creative</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxTokens">Max Response Length</Label>
                      <Input
                        id="maxTokens"
                        type="number"
                        value={formData.max_tokens}
                        onChange={(e) => setFormData(prev => ({ ...prev, max_tokens: parseInt(e.target.value) }))}
                        min={100}
                        max={4096}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Capabilities</CardTitle>
                  <CardDescription>What can your agent help customers with?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'can_view_menu', label: 'View Menu', description: 'Answer questions about menu items' },
                      { key: 'can_view_hours', label: 'View Hours', description: 'Share opening hours and location' },
                      { key: 'can_handle_reservations', label: 'Handle Reservations', description: 'Take and manage bookings' },
                      { key: 'can_process_orders', label: 'Process Orders', description: 'Accept takeaway/delivery orders' },
                      { key: 'can_access_loyalty', label: 'Loyalty Access', description: 'Check loyalty points and rewards' },
                    ].map(cap => (
                      <label key={cap.key} className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={formData.capabilities?.[cap.key as keyof AgentCapabilities] as boolean || false}
                          onChange={(e) => updateCapability(cap.key as keyof AgentCapabilities, e.target.checked)}
                          className="mt-1"
                        />
                        <div>
                          <div className="font-medium">{cap.label}</div>
                          <div className="text-xs text-muted-foreground">{cap.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="mt-4 flex items-start gap-3 p-3 border rounded-lg">
                    <input
                      type="checkbox"
                      checked={formData.menu_context_enabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, menu_context_enabled: e.target.checked }))}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">Include Menu Context</div>
                      <div className="text-xs text-muted-foreground">
                        Automatically include your menu items in the agent&apos;s knowledge base
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleUpdateAgent} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            </div>
          )}

          {/* Knowledge Tab */}
          {activeTab === 'knowledge' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>FAQs</CardTitle>
                  <CardDescription>Common questions and answers for your agent</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.custom_knowledge?.faqs?.map((faq, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">Q: {faq.question}</p>
                          <p className="text-sm text-muted-foreground mt-1">A: {faq.answer}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveFaq(index)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  <div className="space-y-2 pt-4 border-t">
                    <Label>Add New FAQ</Label>
                    <Input
                      placeholder="Question..."
                      value={newFaqQuestion}
                      onChange={(e) => setNewFaqQuestion(e.target.value)}
                    />
                    <Input
                      placeholder="Answer..."
                      value={newFaqAnswer}
                      onChange={(e) => setNewFaqAnswer(e.target.value)}
                    />
                    <Button variant="outline" onClick={handleAddFaq} disabled={!newFaqQuestion || !newFaqAnswer}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add FAQ
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Custom Instructions</CardTitle>
                  <CardDescription>Additional context or rules for your agent</CardDescription>
                </CardHeader>
                <CardContent>
                  <textarea
                    value={formData.custom_knowledge?.custom_instructions || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      custom_knowledge: { ...prev.custom_knowledge, custom_instructions: e.target.value },
                    }))}
                    rows={4}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background resize-none"
                    placeholder="e.g., Always mention our daily specials, be extra careful with allergy information..."
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleUpdateAgent} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Knowledge
                </Button>
              </div>
            </div>
          )}

          {/* Channels Tab */}
          {activeTab === 'channels' && (
            <div className="space-y-6">
              {/* Telegram */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-blue-500" />
                    Telegram
                  </CardTitle>
                  <CardDescription>
                    Connect a Telegram bot to chat with customers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {agent.has_telegram ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800">Telegram Connected</p>
                        <p className="text-sm text-green-600">@{agent.telegram_bot_username}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="telegramToken">Bot Token</Label>
                        <div className="relative">
                          <Input
                            id="telegramToken"
                            type={showTelegramToken ? 'text' : 'password'}
                            value={telegramToken}
                            onChange={(e) => setTelegramToken(e.target.value)}
                            placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setShowTelegramToken(!showTelegramToken)}
                          >
                            {showTelegramToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Get this from <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">@BotFather</a> on Telegram
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="telegramUsername">Bot Username (optional)</Label>
                        <Input
                          id="telegramUsername"
                          value={telegramUsername}
                          onChange={(e) => setTelegramUsername(e.target.value)}
                          placeholder="your_bot_username"
                        />
                      </div>
                      <Button onClick={handleConfigureTelegram} disabled={isConfiguringChannel || !telegramToken}>
                        {isConfiguringChannel ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                        Connect Telegram
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* WhatsApp */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-green-500" />
                    WhatsApp Business
                  </CardTitle>
                  <CardDescription>
                    Connect WhatsApp Business API for customer messaging
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {agent.has_whatsapp ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800">WhatsApp Connected</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Phone className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground mb-4">
                        WhatsApp Business API integration coming soon
                      </p>
                      <Button variant="outline" disabled>
                        Coming Soon
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Web Widget */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-purple-500" />
                    Website Chat Widget
                  </CardTitle>
                  <CardDescription>
                    Embed a chat widget on your website
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-muted rounded-lg font-mono text-xs overflow-x-auto">
                    <pre>{`<script src="https://widget.mitch-ai.com/chat.js"></script>
<script>
  MitchChat.init({
    tenantId: '${agent.tenant_id}',
    agentId: '${agent.id}'
  });
</script>`}</pre>
                  </div>
                  <Button
                    variant="outline"
                    className="mt-4 gap-2"
                    onClick={() => {
                      navigator.clipboard.writeText(`<script src="https://widget.mitch-ai.com/chat.js"></script>\n<script>\n  MitchChat.init({\n    tenantId: '${agent.tenant_id}',\n    agentId: '${agent.id}'\n  });\n</script>`)
                      setSuccess('Widget code copied!')
                      setTimeout(() => setSuccess(null), 2000)
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Copy Code
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
