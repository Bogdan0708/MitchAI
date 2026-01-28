'use client'

import { useState } from 'react'
import { 
  Sparkles, Loader2, Copy, Check, FileText, Instagram, 
  Facebook, Twitter, Mail, MessageCircle, RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

type ContentType = 'social_post' | 'email' | 'promo' | 'announcement'
type Platform = 'instagram' | 'facebook' | 'twitter' | 'email' | 'whatsapp'
type Tone = 'professional' | 'friendly' | 'exciting' | 'informative'

const contentTypes = [
  { value: 'social_post', label: 'Social Post', icon: Instagram },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'promo', label: 'Promotion', icon: FileText },
  { value: 'announcement', label: 'Announcement', icon: FileText },
] as const

const platformOptions = [
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: 'bg-pink-100 text-pink-800' },
  { value: 'facebook', label: 'Facebook', icon: Facebook, color: 'bg-blue-100 text-blue-800' },
  { value: 'twitter', label: 'X/Twitter', icon: Twitter, color: 'bg-sky-100 text-sky-800' },
  { value: 'email', label: 'Email', icon: Mail, color: 'bg-gray-100 text-gray-800' },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'bg-green-100 text-green-800' },
] as const

const toneOptions = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'exciting', label: 'Exciting' },
  { value: 'informative', label: 'Informative' },
] as const

export function AIContentGenerator() {
  const [contentType, setContentType] = useState<ContentType>('social_post')
  const [platform, setPlatform] = useState<Platform>('instagram')
  const [tone, setTone] = useState<Tone>('friendly')
  const [topic, setTopic] = useState('')
  const [context, setContext] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedContent, setGeneratedContent] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<{ provider?: string; latencyMs?: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedContent(null)

    try {
      const response = await api.generateContent(
        contentType,
        topic,
        {
          context: context || undefined,
          tone,
          platform: contentType === 'social_post' ? platform : undefined,
        }
      )

      if (response.data) {
        setGeneratedContent(response.data.content)
        setMetadata({
          provider: response.data.provider,
          latencyMs: response.data.latencyMs,
        })
      }
    } catch (err) {
      console.error('Failed to generate content:', err)
      setError('Failed to generate content. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (generatedContent) {
      await navigator.clipboard.writeText(generatedContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleReset = () => {
    setTopic('')
    setContext('')
    setGeneratedContent(null)
    setMetadata(null)
    setError(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          AI Content Generator
        </CardTitle>
        <CardDescription>
          Create marketing content, social posts, and announcements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Content Type */}
        <div className="space-y-2">
          <Label>Content Type</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {contentTypes.map((type) => {
              const Icon = type.icon
              return (
                <button
                  key={type.value}
                  onClick={() => setContentType(type.value)}
                  className={cn(
                    'p-3 rounded-lg border flex flex-col items-center gap-2 transition-all',
                    contentType === type.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{type.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Platform (for social posts) */}
        {contentType === 'social_post' && (
          <div className="space-y-2">
            <Label>Platform</Label>
            <div className="flex flex-wrap gap-2">
              {platformOptions.map((p) => {
                const Icon = p.icon
                return (
                  <Badge
                    key={p.value}
                    variant={platform === p.value ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer transition-all',
                      platform === p.value && p.color
                    )}
                    onClick={() => setPlatform(p.value)}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {p.label}
                  </Badge>
                )
              })}
            </div>
          </div>
        )}

        {/* Topic */}
        <div className="space-y-2">
          <Label htmlFor="topic">Topic / Subject *</Label>
          <Input
            id="topic"
            placeholder="e.g., New summer menu launch, Weekend brunch special"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        {/* Context */}
        <div className="space-y-2">
          <Label htmlFor="context">Additional Context (optional)</Label>
          <textarea
            id="context"
            className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Add details like specific dishes, dates, prices, or any key points to include..."
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>

        {/* Tone */}
        <div className="space-y-2">
          <Label>Tone</Label>
          <div className="flex flex-wrap gap-2">
            {toneOptions.map((t) => (
              <Badge
                key={t.value}
                variant={tone === t.value ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setTone(t.value)}
              >
                {t.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Generate Button */}
        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !topic.trim()}
            className="flex-1"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Content
              </>
            )}
          </Button>
          {generatedContent && (
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          )}
        </div>

        {/* Generated Result */}
        {generatedContent && (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{generatedContent}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Generated by {metadata?.provider} in {metadata?.latencyMs}ms
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleGenerate}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerate
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AIContentGenerator
