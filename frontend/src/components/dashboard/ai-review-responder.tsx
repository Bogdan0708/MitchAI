'use client'

import { useState } from 'react'
import { 
  Sparkles, Loader2, Copy, Check, MessageSquare, Star,
  ThumbsUp, ThumbsDown, Minus, RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

interface ReviewInput {
  platform: string
  rating: number
  text: string
  customerName: string
}

const platformOptions = [
  { value: 'google', label: 'Google', color: 'bg-blue-100 text-blue-800' },
  { value: 'tripadvisor', label: 'TripAdvisor', color: 'bg-green-100 text-green-800' },
  { value: 'yelp', label: 'Yelp', color: 'bg-red-100 text-red-800' },
  { value: 'facebook', label: 'Facebook', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'deliveroo', label: 'Deliveroo', color: 'bg-teal-100 text-teal-800' },
  { value: 'uber_eats', label: 'Uber Eats', color: 'bg-lime-100 text-lime-800' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-800' },
]

const toneOptions = [
  { value: 'professional', label: 'Professional', description: 'Formal and business-like' },
  { value: 'friendly', label: 'Friendly', description: 'Warm and personable' },
  { value: 'casual', label: 'Casual', description: 'Relaxed and conversational' },
] as const

export function AIReviewResponder() {
  const [review, setReview] = useState<ReviewInput>({
    platform: 'google',
    rating: 5,
    text: '',
    customerName: '',
  })
  const [tone, setTone] = useState<'professional' | 'friendly' | 'casual'>('friendly')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedResponse, setGeneratedResponse] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<{ provider?: string; latencyMs?: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getSentiment = (rating: number) => {
    if (rating >= 4) return { icon: ThumbsUp, color: 'text-green-500', label: 'Positive' }
    if (rating >= 3) return { icon: Minus, color: 'text-yellow-500', label: 'Neutral' }
    return { icon: ThumbsDown, color: 'text-red-500', label: 'Negative' }
  }

  const sentiment = getSentiment(review.rating)
  const SentimentIcon = sentiment.icon

  const handleGenerate = async () => {
    if (!review.text.trim()) {
      setError('Please enter the review text')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedResponse(null)

    try {
      const response = await api.generateAIReviewResponseV2(
        {
          platform: review.platform,
          rating: review.rating,
          text: review.text,
          customerName: review.customerName || undefined,
        },
        { tone }
      )

      if (response.data) {
        setGeneratedResponse(response.data.response)
        setMetadata({
          provider: response.data.provider,
          latencyMs: response.data.latencyMs,
        })
      }
    } catch (err) {
      console.error('Failed to generate response:', err)
      setError('Failed to generate response. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRegenerate = () => {
    handleGenerate()
  }

  const handleCopy = async () => {
    if (generatedResponse) {
      await navigator.clipboard.writeText(generatedResponse)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleReset = () => {
    setReview({
      platform: 'google',
      rating: 5,
      text: '',
      customerName: '',
    })
    setGeneratedResponse(null)
    setMetadata(null)
    setError(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          AI Review Responder
        </CardTitle>
        <CardDescription>
          Generate professional responses to customer reviews
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform Selection */}
        <div className="space-y-2">
          <Label>Platform</Label>
          <div className="flex flex-wrap gap-2">
            {platformOptions.map((platform) => (
              <Badge
                key={platform.value}
                variant={review.platform === platform.value ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-all',
                  review.platform === platform.value && platform.color
                )}
                onClick={() => setReview({ ...review, platform: platform.value })}
              >
                {platform.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Rating */}
        <div className="space-y-2">
          <Label>Rating</Label>
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setReview({ ...review, rating: star })}
                  className="focus:outline-none"
                >
                  <Star
                    className={cn(
                      'h-6 w-6 transition-colors',
                      star <= review.rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    )}
                  />
                </button>
              ))}
            </div>
            <div className={cn('flex items-center gap-1 text-sm', sentiment.color)}>
              <SentimentIcon className="h-4 w-4" />
              {sentiment.label}
            </div>
          </div>
        </div>

        {/* Customer Name */}
        <div className="space-y-2">
          <Label htmlFor="customer-name">Customer Name (optional)</Label>
          <Input
            id="customer-name"
            placeholder="e.g., John Smith"
            value={review.customerName}
            onChange={(e) => setReview({ ...review, customerName: e.target.value })}
          />
        </div>

        {/* Review Text */}
        <div className="space-y-2">
          <Label htmlFor="review-text">Review Text *</Label>
          <textarea
            id="review-text"
            className="w-full min-h-[120px] p-3 rounded-md border border-input bg-background text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Paste the customer's review here..."
            value={review.text}
            onChange={(e) => setReview({ ...review, text: e.target.value })}
          />
        </div>

        {/* Tone Selection */}
        <div className="space-y-2">
          <Label>Response Tone</Label>
          <div className="grid grid-cols-3 gap-2">
            {toneOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setTone(option.value)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  tone === option.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.description}</div>
              </button>
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
            disabled={isGenerating || !review.text.trim()}
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
                Generate Response
              </>
            )}
          </Button>
          {generatedResponse && (
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          )}
        </div>

        {/* Generated Result */}
        {generatedResponse && (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{generatedResponse}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Generated by {metadata?.provider} in {metadata?.latencyMs}ms
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRegenerate}>
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

export default AIReviewResponder
