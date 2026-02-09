'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Search,
  Sparkles,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Wand2,
  DollarSign,
  AlertTriangle,
  Check,
  Copy,
  RefreshCw,
  X,
  Save,
  Image as ImageIcon,
  Utensils,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency } from '@/lib/utils'
import { api } from '@/lib/api'

// Types
interface MenuItem {
  id: string
  name: string
  description: string
  originalDescription?: string
  price: number
  suggestedPrice?: number
  categoryId: string
  categoryName: string
  isAvailable: boolean
  aiEnhanced: boolean
  allergens: string[]
  detectedAllergens?: string[]
  imageUrl: string | null
}

interface Category {
  id: string
  name: string
  itemCount: number
}

// AI Style options for description generation
const descriptionStyles = [
  { id: 'upscale', label: 'Upscale', description: 'Elegant, refined language for fine dining', icon: '✨' },
  { id: 'casual', label: 'Casual', description: 'Friendly and approachable tone', icon: '😊' },
  { id: 'trendy', label: 'Trendy', description: 'Modern, hip vocabulary for young audiences', icon: '🔥' },
  { id: 'traditional', label: 'Traditional', description: 'Classic, time-honored descriptions', icon: '🏛️' },
  { id: 'health', label: 'Health-Focused', description: 'Emphasize nutritional benefits', icon: '🥗' },
]

// Allergen configuration
const allergenConfig: Record<string, { label: string; color: string; icon: string }> = {
  gluten: { label: 'Gluten', color: 'bg-yellow-100 text-yellow-800', icon: '🌾' },
  dairy: { label: 'Dairy', color: 'bg-blue-100 text-blue-800', icon: '🥛' },
  eggs: { label: 'Eggs', color: 'bg-orange-100 text-orange-800', icon: '🥚' },
  fish: { label: 'Fish', color: 'bg-cyan-100 text-cyan-800', icon: '🐟' },
  shellfish: { label: 'Shellfish', color: 'bg-pink-100 text-pink-800', icon: '🦐' },
  nuts: { label: 'Tree Nuts', color: 'bg-amber-100 text-amber-800', icon: '🥜' },
  peanuts: { label: 'Peanuts', color: 'bg-amber-100 text-amber-800', icon: '🥜' },
  soy: { label: 'Soy', color: 'bg-green-100 text-green-800', icon: '🫘' },
  sesame: { label: 'Sesame', color: 'bg-stone-100 text-stone-800', icon: '⚪' },
}

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [isEnhancing, setIsEnhancing] = useState<string | null>(null)
  const [isBulkEnhancing, setIsBulkEnhancing] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 })
  const [selectedStyle, setSelectedStyle] = useState('casual')
  const [generatedDescription, setGeneratedDescription] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showPriceSuggestion, setShowPriceSuggestion] = useState(false)
  const [isDetectingAllergens, setIsDetectingAllergens] = useState(false)
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [newItem, setNewItem] = useState<Partial<MenuItem>>({
    name: '',
    description: '',
    price: 0,
    categoryId: '',
    isAvailable: true,
    allergens: [],
    imageUrl: null,
  })

  // Filter items
  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (item.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || item.categoryId === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Fetch menu data from API
  const fetchMenuData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [categoriesRes, itemsRes] = await Promise.all([
        api.getMenuCategories(),
        api.getMenuItems(selectedCategory || undefined),
      ])

      if (categoriesRes.data) {
        const mappedCategories: Category[] = categoriesRes.data.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          itemCount: cat.itemCount || 0,
        }))
        setCategories(mappedCategories)
      }

      if (itemsRes.data) {
        const mappedItems: MenuItem[] = itemsRes.data.map((item: any) => ({
          id: item.id,
          name: item.name,
          description: item.description || '',
          originalDescription: item.originalDescription,
          price: item.price,
          suggestedPrice: item.suggestedPrice,
          categoryId: item.categoryId,
          categoryName: item.categoryName || item.category?.name || '',
          isAvailable: item.isAvailable ?? true,
          aiEnhanced: item.aiEnhanced ?? item.ai_enhanced ?? !!item.ai_description ?? false,
          allergens: item.allergens || [],
          detectedAllergens: item.detectedAllergens,
          imageUrl: item.imageUrl || null,
        }))
        setMenuItems(mappedItems)
      }
    } catch (err) {
      console.error('Failed to fetch menu data:', err)
      setError('Failed to load menu. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedCategory])

  // Fetch on mount
  useEffect(() => {
    fetchMenuData()
  }, [fetchMenuData])

  // Stats
  const stats = {
    total: menuItems.length,
    enhanced: menuItems.filter(i => i.aiEnhanced).length,
    available: menuItems.filter(i => i.isAvailable).length,
    needsEnhancement: menuItems.filter(i => !i.aiEnhanced).length,
  }

  // AI description generation via API
  const generateDescription = async (item: MenuItem, style: string) => {
    setIsGenerating(true)
    setGeneratedDescription(null)

    try {
      const response = await api.generateAIResponse('menu', item.description, {
        style,
        context: { itemName: item.name, category: item.categoryName },
      })
      if (response.data?.response) {
        setGeneratedDescription(response.data.response)
      }
    } catch (err) {
      console.error('Failed to generate description:', err)
      // Fallback to local generation if API fails
      const styleDescriptions: Record<string, string> = {
        upscale: `Artisanally crafted ${item.name.toLowerCase()}, featuring a symphony of premium ingredients meticulously prepared by our culinary team.`,
        casual: `Our delicious ${item.name}! Made fresh with quality ingredients you'll love.`,
        trendy: `The ${item.name} hits different! Fresh, flavor-packed, and totally Insta-worthy.`,
        traditional: `A time-honored classic, our ${item.name} is prepared using traditional recipes passed down through generations.`,
        health: `Nutritiously balanced ${item.name}, thoughtfully prepared to deliver both exceptional flavor and wholesome goodness.`,
      }
      setGeneratedDescription(styleDescriptions[style] || styleDescriptions.casual)
    } finally {
      setIsGenerating(false)
    }
  }

  // AI allergen detection via API
  const detectAllergens = async (item: MenuItem) => {
    setIsDetectingAllergens(true)

    try {
      const response = await api.detectAllergens(item.description, [])
      if (response.data?.allergens && editingItem) {
        setEditingItem({ ...editingItem, detectedAllergens: response.data.allergens })
      }
    } catch (err) {
      console.error('Failed to detect allergens:', err)
      // Fallback to local detection
      const detected: string[] = []
      const text = (item.name + ' ' + item.description).toLowerCase()
      if (text.includes('bread') || text.includes('toast') || text.includes('crouton')) detected.push('gluten')
      if (text.includes('cheese') || text.includes('cream') || text.includes('butter')) detected.push('dairy')
      if (text.includes('egg') || text.includes('mayo')) detected.push('eggs')
      if (text.includes('salmon') || text.includes('tuna') || text.includes('fish')) detected.push('fish')
      if (text.includes('lobster') || text.includes('shrimp') || text.includes('crab')) detected.push('shellfish')
      if (editingItem) setEditingItem({ ...editingItem, detectedAllergens: detected })
    } finally {
      setIsDetectingAllergens(false)
    }
  }

  // Apply AI enhancement to single item via API
  const enhanceItem = async (itemId: string) => {
    setIsEnhancing(itemId)

    try {
      const response = await api.enhanceMenuItem(itemId, { style: selectedStyle, detectAllergens: true })
      const enhancedData = response.data
      if (enhancedData) {
        setMenuItems(items =>
          items.map(item =>
            item.id === itemId
              ? {
                  ...item,
                  description: enhancedData.description || item.description,
                  aiEnhanced: true,
                  originalDescription: item.description,
                  allergens: enhancedData.allergens || item.allergens,
                }
              : item
          )
        )
      }
    } catch (err) {
      console.error('Failed to enhance item:', err)
      setError('Failed to enhance item. Please try again.')
    } finally {
      setIsEnhancing(null)
    }
  }

  // Bulk enhance all items via API
  const bulkEnhance = async () => {
    const itemsToEnhance = menuItems.filter(i => !i.aiEnhanced)
    if (itemsToEnhance.length === 0) return

    setIsBulkEnhancing(true)
    setBulkProgress({ current: 0, total: itemsToEnhance.length })

    try {
      const response = await api.bulkEnhanceMenu(
        itemsToEnhance.map(i => ({
          id: i.id,
          name: i.name,
          category: i.categoryName || i.categoryId,
          allergens: i.allergens,
          price: i.price,
        })),
        selectedStyle
      )

      if (response.data?.results) {
        const enhancedMap = new Map(
          response.data.results
            .filter((r: any) => r.success)
            .map((r: any) => [r.id, r.description])
        )
        setMenuItems(items =>
          items.map(item =>
            enhancedMap.has(item.id)
              ? { ...item, description: enhancedMap.get(item.id), aiEnhanced: true }
              : item
          )
        )
      }
      setBulkProgress({ current: itemsToEnhance.length, total: itemsToEnhance.length })
    } catch (err) {
      console.error('Failed to bulk enhance:', err)
      setError('Failed to enhance all items. Please try again.')
    } finally {
      setIsBulkEnhancing(false)
    }
  }

  // Save edited item via API
  const saveItem = async () => {
    if (!editingItem) return

    try {
      await api.updateMenuItem(editingItem.id, {
        name: editingItem.name,
        description: editingItem.description,
        price: editingItem.price,
        allergens: editingItem.allergens,
        isAvailable: editingItem.isAvailable,
      })

      setMenuItems(items =>
        items.map(item =>
          item.id === editingItem.id
            ? { ...editingItem, aiEnhanced: true }
            : item
        )
      )
      setEditingItem(null)
      setGeneratedDescription(null)
    } catch (err) {
      console.error('Failed to save item:', err)
      setError('Failed to save changes. Please try again.')
    }
  }

  // Toggle item availability via API
  const toggleAvailability = async (itemId: string) => {
    const item = menuItems.find(i => i.id === itemId)
    if (!item) return

    try {
      await api.updateMenuItem(itemId, { isAvailable: !item.isAvailable })
      setMenuItems(items =>
        items.map(i =>
          i.id === itemId
            ? { ...i, isAvailable: !i.isAvailable }
            : i
        )
      )
    } catch (err) {
      console.error('Failed to toggle availability:', err)
      setError('Failed to update availability. Please try again.')
    }
  }

  // Create new menu item via API
  const createItem = async () => {
    if (!newItem.name || !newItem.price) {
      setError('Please fill in the item name and price.')
      return
    }

    const categoryToUse = newItem.categoryId || categories[0]?.id
    if (!categoryToUse) {
      setError('Please create a category first before adding menu items.')
      return
    }

    try {
      // Backend expects snake_case field names
      const response = await api.createMenuItem({
        name: newItem.name,
        description: newItem.description || '',
        price: newItem.price,
        category_id: categoryToUse,
        is_available: newItem.isAvailable ?? true,
        allergens: newItem.allergens || [],
      } as any)

      if (response.data) {
        // Add to local state
        const data = response.data
        const createdItem: MenuItem = {
          id: data.id,
          name: data.name,
          description: data.description || '',
          price: data.price,
          categoryId: data.categoryId || '',
          categoryName: categories.find(c => c.id === data.categoryId)?.name || '',
          isAvailable: data.isAvailable ?? true,
          aiEnhanced: false,
          allergens: data.allergens || [],
          imageUrl: data.imageUrl || null,
        }
        setMenuItems(items => [...items, createdItem])

        // Reset form and close modal
        setNewItem({
          name: '',
          description: '',
          price: 0,
          categoryId: '',
          isAvailable: true,
          allergens: [],
          imageUrl: null,
        })
        setIsAddingItem(false)
      }
    } catch (err) {
      console.error('Failed to create menu item:', err)
      setError('Failed to create menu item. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Menu AI Manager</h1>
          <p className="text-muted-foreground">
            Enhance your menu with AI-powered descriptions, pricing, and allergen detection
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={bulkEnhance}
            disabled={isBulkEnhancing || stats.needsEnhancement === 0}
          >
            {isBulkEnhancing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enhancing {bulkProgress.current}/{bulkProgress.total}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                AI Enhance All ({stats.needsEnhancement})
              </>
            )}
          </Button>
          <Button onClick={() => setIsAddingItem(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Utensils className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.enhanced}</p>
                <p className="text-xs text-muted-foreground">AI Enhanced</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <Eye className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.available}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                <Wand2 className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.needsEnhancement}</p>
                <p className="text-xs text-muted-foreground">Need Enhancement</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Enhancement Progress */}
      {isBulkEnhancing && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="font-medium">AI Enhancement in Progress</p>
                <p className="text-sm text-muted-foreground">
                  Processing {bulkProgress.current} of {bulkProgress.total} items...
                </p>
              </div>
              <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                !selectedCategory ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              <span>All Items</span>
              <Badge variant={!selectedCategory ? 'secondary' : 'outline'} className="ml-2">
                {menuItems.length}
              </Badge>
            </button>
            {categories.map((category) => {
              const count = menuItems.filter(i => i.categoryId === category.id).length
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                    selectedCategory === category.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                >
                  <span>{category.name}</span>
                  <Badge variant={selectedCategory === category.id ? 'secondary' : 'outline'} className="ml-2">
                    {count}
                  </Badge>
                </button>
              )
            })}
            <Button variant="ghost" className="w-full justify-start text-muted-foreground mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Items List */}
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <Card key={item.id} className={cn(!item.isAvailable && 'opacity-60')}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Image placeholder */}
                    <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 relative group">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover rounded-lg" />
                      ) : (
                        <span className="text-3xl">🍽️</span>
                      )}
                      <button className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-white" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{item.name}</h3>
                            {item.aiEnhanced && (
                              <Badge variant="secondary" className="gap-1 bg-purple-100 text-purple-700">
                                <Sparkles className="h-3 w-3" />
                                AI Enhanced
                              </Badge>
                            )}
                            {!item.isAvailable && (
                              <Badge variant="destructive">Unavailable</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{item.categoryName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="text-lg font-bold">{formatCurrency(item.price)}</span>
                            {item.suggestedPrice && item.suggestedPrice !== item.price && (
                              <p className="text-xs text-green-600">
                                AI suggests {formatCurrency(item.suggestedPrice)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Description with comparison */}
                      <div className="mt-2">
                        {item.originalDescription && item.aiEnhanced ? (
                          <div className="space-y-1">
                            <p className="text-sm line-through text-muted-foreground">
                              {item.originalDescription}
                            </p>
                            <p className="text-sm text-foreground">
                              {item.description}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Allergens */}
                      {item.allergens.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {item.allergens.map((allergen) => {
                            const config = allergenConfig[allergen]
                            return (
                              <span
                                key={allergen}
                                className={cn(
                                  'px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1',
                                  config?.color || 'bg-gray-100 text-gray-800'
                                )}
                              >
                                {config?.icon} {config?.label || allergen}
                              </span>
                            )
                          })}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingItem(item)
                            setGeneratedDescription(null)
                          }}
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        {!item.aiEnhanced && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => enhanceItem(item.id)}
                            disabled={isEnhancing === item.id}
                          >
                            {isEnhancing === item.id ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Enhancing...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3 w-3 mr-1" />
                                AI Enhance
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAvailability(item.id)}
                        >
                          {item.isAvailable ? (
                            <>
                              <EyeOff className="h-3 w-3 mr-1" />
                              Hide
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3 mr-1" />
                              Show
                            </>
                          )}
                        </Button>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredItems.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Utensils className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No menu items found</p>
                  <Button variant="outline" className="mt-4" onClick={() => setIsAddingItem(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add your first item
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Edit Menu Item</CardTitle>
                <CardDescription>Use AI to enhance your menu item</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingItem(null)
                  setGeneratedDescription(null)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Item Name</label>
                  <Input
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Price</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      value={editingItem.price}
                      onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) })}
                      className="pl-9"
                    />
                  </div>
                  {editingItem.suggestedPrice && editingItem.suggestedPrice !== editingItem.price && (
                    <button
                      className="text-xs text-green-600 hover:underline flex items-center gap-1"
                      onClick={() => setEditingItem({ ...editingItem, price: editingItem.suggestedPrice! })}
                    >
                      <DollarSign className="h-3 w-3" />
                      Apply AI suggested price: {formatCurrency(editingItem.suggestedPrice)}
                    </button>
                  )}
                </div>
              </div>

              {/* AI Description Generator */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Description</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">AI Style:</span>
                    <select
                      value={selectedStyle}
                      onChange={(e) => setSelectedStyle(e.target.value)}
                      className="text-xs border border-input rounded px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {descriptionStyles.map(style => (
                        <option key={style.id} value={style.id}>
                          {style.icon} {style.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateDescription(editingItem, selectedStyle)}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-3 w-3 mr-1" />
                          Generate
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <textarea
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full min-h-[100px] p-3 border border-input rounded-lg text-sm resize-none bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter item description..."
                />

                {/* Generated Description Preview */}
                {generatedDescription && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-purple-700 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        AI Generated ({descriptionStyles.find(s => s.id === selectedStyle)?.label})
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => generateDescription(editingItem, selectedStyle)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Regenerate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-green-600"
                          onClick={() => {
                            setEditingItem({ ...editingItem, description: generatedDescription })
                            setGeneratedDescription(null)
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Apply
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-purple-900">{generatedDescription}</p>
                  </div>
                )}

                {/* Style Guide */}
                <div className="grid grid-cols-5 gap-2">
                  {descriptionStyles.map(style => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style.id)}
                      className={cn(
                        'p-2 rounded-lg border text-center transition-all',
                        selectedStyle === style.id
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground/50'
                      )}
                    >
                      <span className="text-lg">{style.icon}</span>
                      <p className="text-xs font-medium mt-1">{style.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Allergen Detection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Allergens</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => detectAllergens(editingItem)}
                    disabled={isDetectingAllergens}
                  >
                    {isDetectingAllergens ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Detecting...
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        AI Detect Allergens
                      </>
                    )}
                  </Button>
                </div>

                {/* Current Allergens */}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(allergenConfig).map(([key, config]) => {
                    const allergens = editingItem.allergens || []
                    const isSelected = allergens.includes(key)
                    const isDetected = editingItem.detectedAllergens?.includes(key)
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          const newAllergens = isSelected
                            ? allergens.filter(a => a !== key)
                            : [...allergens, key]
                          setEditingItem({ ...editingItem, allergens: newAllergens })
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all',
                          isSelected
                            ? config.color + ' border-transparent'
                            : 'bg-muted/50 text-muted-foreground border-transparent hover:border-muted-foreground/50',
                          isDetected && !isSelected && 'ring-2 ring-yellow-400'
                        )}
                      >
                        {config.icon} {config.label}
                        {isDetected && !isSelected && (
                          <span className="text-yellow-600 text-[10px]">(detected)</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {editingItem.detectedAllergens && editingItem.detectedAllergens.length > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    AI detected potential allergens highlighted with yellow ring
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingItem(null)
                    setGeneratedDescription(null)
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={saveItem}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Item Modal */}
      {isAddingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Add Menu Item</CardTitle>
                <CardDescription>Create a new item for your menu</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsAddingItem(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Item Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Item Name *</label>
                <Input
                  placeholder="e.g., Grilled Salmon"
                  value={newItem.name || ''}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <select
                  value={newItem.categoryId || ''}
                  onChange={(e) => setNewItem({ ...newItem, categoryId: e.target.value })}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Price *</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newItem.price || ''}
                    onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  placeholder="Describe your menu item..."
                  value={newItem.description || ''}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className="w-full min-h-[80px] p-3 border border-input rounded-lg text-sm resize-none bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Availability */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="available"
                  checked={newItem.isAvailable ?? true}
                  onChange={(e) => setNewItem({ ...newItem, isAvailable: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="available" className="text-sm">Available for ordering</label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setNewItem({
                      name: '',
                      description: '',
                      price: 0,
                      categoryId: '',
                      isAvailable: true,
                      allergens: [],
                      imageUrl: null,
                    })
                    setIsAddingItem(false)
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={createItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
