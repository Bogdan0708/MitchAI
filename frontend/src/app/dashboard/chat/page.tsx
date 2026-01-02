'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send,
  Search,
  MoreVertical,
  Phone,
  Mail,
  Clock,
  MessageSquare,
  RefreshCw,
  Loader2,
  Bot,
  User,
  Sparkles,
  ExternalLink,
  Copy,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  CheckCircle,
  Settings,
  Code,
  Globe,
  Zap,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  Plus,
  ShoppingCart,
  Calendar,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, formatTime, formatCurrency } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'

interface ChatSession {
  id: string
  sessionId: string
  customerName: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  lastMessage: string | null
  channel: string
  status: string
  messageCount: number
  sentimentScore?: number
  resolvedByAi: boolean
  escalatedToHuman: boolean
  createdAt: string
  updatedAt: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  aiProvider?: string | null
  aiModel?: string | null
  responseTimeMs?: number
  createdAt: string
}

interface CustomerContext {
  totalOrders: number
  totalSpent: number
  lastOrderDate: string | null
  loyaltyTier: string
  preferences: string[]
}

// Quick reply templates
const quickReplies = [
  { id: '1', label: 'Hours', message: 'We\'re open Monday-Saturday 11am-10pm, Sunday 12pm-8pm.' },
  { id: '2', label: 'Location', message: 'We\'re located at 123 Main Street. There\'s parking available behind the building.' },
  { id: '3', label: 'Reservations', message: 'You can make a reservation on our website or call us at (555) 123-4567.' },
  { id: '4', label: 'Menu', message: 'Our full menu is available at our website. Would you like me to recommend something specific?' },
  { id: '5', label: 'Dietary', message: 'We offer vegetarian, vegan, and gluten-free options. Let me know your dietary requirements!' },
  { id: '6', label: 'Wait Time', message: 'Current wait time is approximately 15-20 minutes. Would you like to be added to the waitlist?' },
]

// AI suggested responses
const aiSuggestions = [
  'Based on their order history, recommend the Grilled Salmon - it\'s similar to their previous favorites.',
  'Offer a 10% loyalty discount - they\'re a frequent customer.',
  'Ask if they\'d like to try our new seasonal special.',
]

const channelConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  web: { icon: <Globe className="h-3 w-3" />, color: 'bg-blue-100 text-blue-700', label: 'Website' },
  whatsapp: { icon: <Phone className="h-3 w-3" />, color: 'bg-green-100 text-green-700', label: 'WhatsApp' },
  email: { icon: <Mail className="h-3 w-3" />, color: 'bg-purple-100 text-purple-700', label: 'Email' },
  voice: { icon: <Volume2 className="h-3 w-3" />, color: 'bg-orange-100 text-orange-700', label: 'Voice' },
  sms: { icon: <MessageSquare className="h-3 w-3" />, color: 'bg-cyan-100 text-cyan-700', label: 'SMS' },
}

// Default customer context when none available
const defaultCustomerContext: CustomerContext = {
  totalOrders: 0,
  totalSpent: 0,
  lastOrderDate: null,
  loyaltyTier: 'New',
  preferences: [],
}

export default function ChatPage() {
  const { tenant } = useAuth()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoadingSessions, setIsLoadingSessions] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showWidgetConfig, setShowWidgetConfig] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [showCustomerContext, setShowCustomerContext] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const customerContext = defaultCustomerContext

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Fetch sessions from API
  const fetchSessions = useCallback(async () => {
    try {
      setIsLoadingSessions(true)
      setError(null)
      const response = await api.getChatSessions()
      if (response.items) {
        const mappedSessions: ChatSession[] = response.items.map((s: any) => ({
          id: s.id,
          sessionId: s.sessionId || s.id,
          customerName: s.customerName || 'Guest',
          customerEmail: s.customerEmail,
          customerPhone: s.customerPhone,
          lastMessage: s.lastMessage,
          channel: s.channel || 'web',
          status: s.status || 'active',
          messageCount: s.messageCount || 0,
          sentimentScore: s.sentimentScore,
          resolvedByAi: s.resolvedByAi || false,
          escalatedToHuman: s.escalatedToHuman || false,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        }))
        setSessions(mappedSessions)
        if (mappedSessions.length > 0 && !selectedSession) {
          setSelectedSession(mappedSessions[0])
        }
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err)
      setError('Failed to load conversations')
    } finally {
      setIsLoadingSessions(false)
    }
  }, [selectedSession])

  // Fetch messages for selected session
  const fetchMessages = useCallback(async (sessionId: string) => {
    try {
      setIsLoadingMessages(true)
      const response = await api.getChatMessages(sessionId)
      if (response.data) {
        const mappedMessages: ChatMessage[] = response.data.map((m: any) => ({
          id: m.id,
          role: m.role || (m.isFromUser ? 'user' : 'assistant'),
          content: m.content || m.message,
          aiProvider: m.aiProvider,
          aiModel: m.aiModel,
          responseTimeMs: m.responseTimeMs,
          createdAt: m.createdAt,
        }))
        setMessages(mappedMessages)
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    } finally {
      setIsLoadingMessages(false)
    }
  }, [])

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Fetch messages when session changes
  useEffect(() => {
    if (selectedSession) {
      fetchMessages(selectedSession.id)
    }
  }, [selectedSession, fetchMessages])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedSession) return

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: newMessage,
      createdAt: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    const messageToSend = newMessage
    setNewMessage('')
    setIsSending(true)

    try {
      const response = await api.sendChatMessage(selectedSession.id, messageToSend)

      if (response.data?.response) {
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: response.data.response,
          aiProvider: 'claude',
          aiModel: 'claude-3-haiku',
          createdAt: new Date().toISOString(),
        }
        setMessages(prev => [...prev, aiMessage])
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: 'Failed to send message. Please try again.',
        createdAt: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsSending(false)
    }
  }

  const handleQuickReply = (message: string) => {
    setNewMessage(message)
    setShowQuickReplies(false)
  }

  const filteredSessions = sessions.filter(session =>
    (session.customerName || 'Guest').toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Stats
  const stats = {
    active: sessions.filter(s => s.status === 'active').length,
    resolved: sessions.filter(s => s.resolvedByAi).length,
    escalated: sessions.filter(s => s.escalatedToHuman).length,
    avgResponseTime: '0.4s',
  }

  const getSentimentColor = (score: number | undefined) => {
    if (score === undefined) return 'bg-gray-100'
    if (score >= 0.6) return 'bg-green-100'
    if (score >= 0) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const getStatusBadge = (session: ChatSession) => {
    if (session.escalatedToHuman) {
      return <Badge variant="destructive" className="text-xs">Escalated</Badge>
    }
    if (session.status === 'closed') {
      return <Badge variant="secondary" className="text-xs">Resolved</Badge>
    }
    return <Badge variant="default" className="text-xs">Active</Badge>
  }

  return (
    <div className="h-[calc(100vh-7rem)]">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Active Chats</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
              <Bot className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.resolved}</p>
              <p className="text-xs text-muted-foreground">AI Resolved</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
              <User className="h-4 w-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.escalated}</p>
              <p className="text-xs text-muted-foreground">Escalated</p>
            </div>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
              <Zap className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{stats.avgResponseTime}</p>
              <p className="text-xs text-muted-foreground">Avg Response</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex h-[calc(100%-5rem)] gap-4">
        {/* Conversations List */}
        <Card className="w-80 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Conversations</CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowWidgetConfig(!showWidgetConfig)}
                  className="h-8 w-8"
                  title="Widget Settings"
                >
                  <Code className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-2">
            {filteredSessions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No conversations found
              </div>
            ) : (
              <div className="space-y-1">
                {filteredSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={cn(
                      'w-full p-3 rounded-lg text-left transition-colors',
                      selectedSession?.id === session.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium relative',
                          selectedSession?.id === session.id
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}>
                          {(session.customerName || 'G').split(' ').map(n => n[0]).join('').slice(0, 2)}
                          <div className={cn(
                            'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2',
                            selectedSession?.id === session.id ? 'border-primary' : 'border-background',
                            getSentimentColor(session.sentimentScore)
                          )} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{session.customerName || 'Guest'}</p>
                          <div className="flex items-center gap-1">
                            <span className={cn(
                              channelConfig[session.channel]?.color || 'bg-gray-100 text-gray-700',
                              'px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1'
                            )}>
                              {channelConfig[session.channel]?.icon}
                              {channelConfig[session.channel]?.label || session.channel}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn(
                          'text-xs',
                          selectedSession?.id === session.id
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground'
                        )}>
                          {formatTime(session.updatedAt)}
                        </span>
                        {session.resolvedByAi && (
                          <Bot className={cn(
                            'h-3 w-3',
                            selectedSession?.id === session.id
                              ? 'text-primary-foreground/70'
                              : 'text-green-500'
                          )} />
                        )}
                      </div>
                    </div>
                    <p className={cn(
                      'text-xs mt-2 truncate',
                      selectedSession?.id === session.id
                        ? 'text-primary-foreground/70'
                        : 'text-muted-foreground'
                    )}>
                      {session.lastMessage}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat Window */}
        <Card className="flex-1 flex flex-col">
          {selectedSession ? (
            <>
              {/* Chat Header */}
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-medium relative">
                      {(selectedSession.customerName || 'G').split(' ').map(n => n[0]).join('').slice(0, 2)}
                      <div className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background',
                        getSentimentColor(selectedSession.sentimentScore)
                      )} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{selectedSession.customerName || 'Guest'}</CardTitle>
                        {getStatusBadge(selectedSession)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className={cn(
                          channelConfig[selectedSession.channel]?.color || 'bg-gray-100 text-gray-700',
                          'px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1'
                        )}>
                          {channelConfig[selectedSession.channel]?.icon}
                          {channelConfig[selectedSession.channel]?.label}
                        </span>
                        <span>•</span>
                        <Clock className="h-3 w-3" />
                        <span>{formatTime(selectedSession.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={aiEnabled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAiEnabled(!aiEnabled)}
                      className="gap-1"
                    >
                      <Bot className="h-3 w-3" />
                      AI {aiEnabled ? 'On' : 'Off'}
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex',
                        message.role === 'user' ? 'justify-end' :
                        message.role === 'system' ? 'justify-center' :
                        'justify-start'
                      )}
                    >
                      {message.role === 'system' ? (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 max-w-[80%]">
                          <p className="text-sm text-yellow-800">{message.content}</p>
                        </div>
                      ) : (
                        <div className={cn('flex gap-2 max-w-[70%]', message.role === 'user' && 'flex-row-reverse')}>
                          <div className={cn(
                            'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
                            message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                          )}>
                            {message.role === 'user' ? (
                              <User className="h-4 w-4" />
                            ) : (
                              <Bot className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div
                              className={cn(
                                'rounded-2xl px-4 py-2',
                                message.role === 'user'
                                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                  : 'bg-muted rounded-tl-sm'
                              )}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            </div>
                            <div className={cn(
                              'flex items-center gap-2 mt-1 px-1',
                              message.role === 'user' ? 'justify-end' : 'justify-start'
                            )}>
                              <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
                              {message.aiProvider && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Sparkles className="h-3 w-3" />
                                  {message.aiProvider} ({message.responseTimeMs}ms)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {isSending && (
                    <div className="flex justify-start">
                      <div className="flex gap-2">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                          <div className="flex gap-1">
                            <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </CardContent>

              {/* Quick Replies */}
              {showQuickReplies && (
                <div className="px-4 pb-2">
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map((reply) => (
                      <Button
                        key={reply.id}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleQuickReply(reply.message)}
                      >
                        {reply.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className={showQuickReplies ? 'bg-primary/10' : ''}
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    className="flex-1"
                    disabled={isSending}
                  />
                  <Button onClick={handleSendMessage} disabled={!newMessage.trim() || isSending}>
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a conversation to start chatting
            </div>
          )}
        </Card>

        {/* Customer Context Sidebar */}
        {selectedSession && showCustomerContext && customerContext && (
          <Card className="w-64 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Customer Info</CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowCustomerContext(false)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {/* Contact Info */}
              <div className="space-y-2">
                <p className="font-medium text-xs text-muted-foreground uppercase">Contact</p>
                {selectedSession.customerEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs truncate">{selectedSession.customerEmail}</span>
                  </div>
                )}
                {selectedSession.customerPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">{selectedSession.customerPhone}</span>
                  </div>
                )}
              </div>

              {/* Order History */}
              <div className="space-y-2">
                <p className="font-medium text-xs text-muted-foreground uppercase">Order History</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-muted rounded text-center">
                    <p className="text-lg font-bold">{customerContext.totalOrders}</p>
                    <p className="text-[10px] text-muted-foreground">Orders</p>
                  </div>
                  <div className="p-2 bg-muted rounded text-center">
                    <p className="text-lg font-bold">{formatCurrency(customerContext.totalSpent)}</p>
                    <p className="text-[10px] text-muted-foreground">Total Spent</p>
                  </div>
                </div>
              </div>

              {/* Loyalty */}
              <div className="space-y-2">
                <p className="font-medium text-xs text-muted-foreground uppercase">Loyalty</p>
                <Badge variant="outline" className={cn(
                  'w-full justify-center',
                  customerContext.loyaltyTier === 'Gold' && 'bg-yellow-50 text-yellow-700 border-yellow-200',
                  customerContext.loyaltyTier === 'Silver' && 'bg-gray-50 text-gray-700 border-gray-200',
                  customerContext.loyaltyTier === 'Bronze' && 'bg-orange-50 text-orange-700 border-orange-200',
                )}>
                  {customerContext.loyaltyTier} Member
                </Badge>
              </div>

              {/* Preferences */}
              {customerContext.preferences.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-xs text-muted-foreground uppercase">Preferences</p>
                  <div className="flex flex-wrap gap-1">
                    {customerContext.preferences.map((pref, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {pref}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Suggestions */}
              <div className="space-y-2">
                <p className="font-medium text-xs text-muted-foreground uppercase flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Suggestions
                </p>
                <div className="space-y-2">
                  {aiSuggestions.slice(0, 2).map((suggestion, i) => (
                    <div key={i} className="p-2 bg-purple-50 rounded text-[10px] text-purple-700">
                      {suggestion}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2 pt-2 border-t">
                <Button variant="outline" size="sm" className="w-full justify-start text-xs gap-2">
                  <ShoppingCart className="h-3 w-3" />
                  View Orders
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs gap-2">
                  <Calendar className="h-3 w-3" />
                  New Reservation
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Widget Config Modal */}
      {showWidgetConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Embed Chat Widget
              </CardTitle>
              <CardDescription>
                Add this code to your website to enable the AI chat assistant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg font-mono text-xs overflow-x-auto">
                <pre>{`<script src="https://widget.mitch-ai.com/chat.js"></script>
<script>
  MitchChat.init({
    tenantId: '${tenant?.id || 'YOUR_TENANT_ID'}',
    primaryColor: '#6366f1',
    position: 'bottom-right',
    greeting: 'Hi! How can I help you today?'
  });
</script>`}</pre>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(`<script src="https://widget.mitch-ai.com/chat.js"></script>\n<script>\n  MitchChat.init({\n    tenantId: '${tenant?.id || 'YOUR_TENANT_ID'}',\n    primaryColor: '#6366f1',\n    position: 'bottom-right',\n    greeting: 'Hi! How can I help you today?'\n  });\n</script>`)
                }}
              >
                <Copy className="h-4 w-4" />
                Copy Code
              </Button>
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  Widget Preview
                </div>
                <Button variant="outline" size="sm" className="gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Open Preview
                </Button>
              </div>
            </CardContent>
            <div className="px-6 pb-6">
              <Button className="w-full" onClick={() => setShowWidgetConfig(false)}>
                Done
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
