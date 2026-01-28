'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Copy, Check, ChefHat, Leaf, Wheat, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

interface MenuItemInput {
  name: string
  category: string
  ingredients: string
  price: string
  isVegetarian: boolean
  isVegan: boolean
  isGlutenFree: boolean
}

const styleOptions = [
  { value: 'elegant', label: 'Elegant', description: 'Sophisticated fine dining' },
  { value: 'casual', label: 'Casual', description: 'Friendly and approachable' },
  { value: 'fun', label: 'Fun', description: 'Playful with personality' },
  { value: 'descriptive', label: 'Descriptive', description: 'Detailed flavor focus' },
] as const

export function AIMenuGenerator() {
  const [item, setItem] = useState<MenuItemInput>({
    name: '',
    category: '',
    ingredients: '',
    price: '',
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: false,
  })
  const [style, setStyle] = useState<'elegant' | 'casual' | 'fun' | 'descriptive'>('descriptive')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedDescription, setGeneratedDescription] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<{ provider?: string; latencyMs?: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!item.name.trim()) {
      setError('Please enter a dish name')
      return
    }

    setIsGenerating(true)
    setError(null)
    setGeneratedDescription(null)

    try {
      const response = await api.generateMenuDescription(
        {
          name: item.name,
          category: item.category || undefined,
          ingredients: item.ingredients ? item.ingredients.split(',').map(i => i.trim()) : undefined,
          price: item.price ? parseFloat(item.price) : undefined,
          isVegetarian: item.isVegetarian,
          isVegan: item.isVegan,
          isGlutenFree: item.isGlutenFree,
        },
        { style }
      )

      if (response.data) {
        setGeneratedDescription(response.data.description)
        setMetadata({
          provider: response.data.provider,
          latencyMs: response.data.latencyMs,
        })
      }
    } catch (err) {
      console.error('Failed to generate description:', err)
      setError('Failed to generate description. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (generatedDescription) {
      await navigator.clipboard.writeText(generatedDescription)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleReset = () => {
    setItem({
      name: '',
      category: '',
      ingredients: '',
      price: '',
      isVegetarian: false,
      isVegan: false,
      isGlutenFree: false,
    })
    setGeneratedDescription(null)
    setMetadata(null)
    setError(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChefHat className="h-5 w-5" />
          Menu Description Generator
        </CardTitle>
        <CardDescription>
          Create appetizing menu descriptions with AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Form */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dish-name">Dish Name *</Label>
            <Input
              id="dish-name"
              placeholder="e.g., Pan-Seared Sea Bass"
              value={item.name}
              onChange={(e) => setItem({ ...item, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              placeholder="e.g., Main Course, Appetizer"
              value={item.category}
              onChange={(e) => setItem({ ...item, category: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="ingredients">Key Ingredients (comma-separated)</Label>
            <Input
              id="ingredients"
              placeholder="e.g., sea bass, lemon, capers, butter, herbs"
              value={item.ingredients}
              onChange={(e) => setItem({ ...item, ingredients: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Price (£)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              placeholder="e.g., 24.50"
              value={item.price}
              onChange={(e) => setItem({ ...item, price: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Dietary Tags</Label>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={item.isVegetarian ? 'default' : 'outline'}
                className={cn('cursor-pointer', item.isVegetarian && 'bg-green-600')}
                onClick={() => setItem({ ...item, isVegetarian: !item.isVegetarian })}
              >
                <Leaf className="h-3 w-3 mr-1" />
                Vegetarian
              </Badge>
              <Badge
                variant={item.isVegan ? 'default' : 'outline'}
                className={cn('cursor-pointer', item.isVegan && 'bg-green-700')}
                onClick={() => setItem({ ...item, isVegan: !item.isVegan, isVegetarian: !item.isVegan ? true : item.isVegetarian })}
              >
                <Leaf className="h-3 w-3 mr-1" />
                Vegan
              </Badge>
              <Badge
                variant={item.isGlutenFree ? 'default' : 'outline'}
                className={cn('cursor-pointer', item.isGlutenFree && 'bg-amber-600')}
                onClick={() => setItem({ ...item, isGlutenFree: !item.isGlutenFree })}
              >
                <Wheat className="h-3 w-3 mr-1" />
                Gluten-Free
              </Badge>
            </div>
          </div>
        </div>

        {/* Style Selection */}
        <div className="space-y-2">
          <Label>Writing Style</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {styleOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setStyle(option.value)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  style === option.value
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
            disabled={isGenerating || !item.name.trim()}
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
                Generate Description
              </>
            )}
          </Button>
          {generatedDescription && (
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          )}
        </div>

        {/* Generated Result */}
        {generatedDescription && (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm leading-relaxed">{generatedDescription}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                <span>Generated by {metadata?.provider} in {metadata?.latencyMs}ms</span>
              </div>
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
        )}
      </CardContent>
    </Card>
  )
}

export default AIMenuGenerator
