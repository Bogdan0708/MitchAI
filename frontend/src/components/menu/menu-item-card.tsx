'use client'

import * as React from 'react'
import Image from 'next/image'
import { cn, formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  Sparkles,
  AlertTriangle
} from 'lucide-react'

interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  suggestedPrice?: number
  categoryName: string
  isAvailable: boolean
  aiEnhanced: boolean
  allergens: string[]
  imageUrl: string | null
}

interface MenuItemCardProps {
  item: MenuItem
  onEdit?: (item: MenuItem) => void
  onDelete?: (item: MenuItem) => void
  onToggleAvailability?: (item: MenuItem) => void
  className?: string
}

const dietaryBadges: Record<string, { label: string; className: string }> = {
  vegan: { label: 'Vegan', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  vegetarian: { label: 'Vegetarian', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  'gluten-free': { label: 'GF', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  'dairy-free': { label: 'DF', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  halal: { label: 'Halal', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  spicy: { label: '🌶️', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

export function MenuItemCard({
  item,
  onEdit,
  onDelete,
  onToggleAvailability,
  className,
}: MenuItemCardProps) {
  const [showActions, setShowActions] = React.useState(false)

  return (
    <div
      className={cn(
        'group relative bg-card border border-border rounded-xl overflow-hidden transition-all duration-200',
        'hover:shadow-lg hover:scale-[1.02]',
        !item.isAvailable && 'opacity-60',
        className
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <span className="text-4xl">🍽️</span>
          </div>
        )}
        
        {/* Availability Badge */}
        {!item.isAvailable && (
          <div className="absolute top-2 left-2">
            <Badge variant="destructive" className="text-xs">
              Unavailable
            </Badge>
          </div>
        )}

        {/* AI Enhanced Badge */}
        {item.aiEnhanced && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-purple-500 text-white text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              AI
            </Badge>
          </div>
        )}

        {/* Price Tag */}
        <div className="absolute bottom-2 right-2">
          <div className="bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm">
            <span className="font-bold text-foreground">
              {formatCurrency(item.price)}
            </span>
            {item.suggestedPrice && item.suggestedPrice !== item.price && (
              <span className="ml-1 text-xs text-muted-foreground line-through">
                {formatCurrency(item.suggestedPrice)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {item.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {item.categoryName}
            </p>
          </div>
          
          {/* Actions Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setShowActions(!showActions)}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            
            {showActions && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowActions(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-popover border border-border rounded-lg shadow-lg py-1">
                  {onEdit && (
                    <button
                      onClick={() => { onEdit(item); setShowActions(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-accent"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </button>
                  )}
                  {onToggleAvailability && (
                    <button
                      onClick={() => { onToggleAvailability(item); setShowActions(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-accent"
                    >
                      {item.isAvailable ? (
                        <>
                          <EyeOff className="h-4 w-4" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" />
                          Show
                        </>
                      )}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => { onDelete(item); setShowActions(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
          {item.description || 'No description'}
        </p>

        {/* Allergens / Dietary Info */}
        {item.allergens.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {item.allergens.slice(0, 4).map((allergen) => {
              const badge = dietaryBadges[allergen.toLowerCase()]
              return badge ? (
                <span
                  key={allergen}
                  className={cn(
                    'px-2 py-0.5 text-xs rounded-full font-medium',
                    badge.className
                  )}
                >
                  {badge.label}
                </span>
              ) : (
                <span
                  key={allergen}
                  className="px-2 py-0.5 text-xs rounded-full font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 flex items-center gap-1"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {allergen}
                </span>
              )
            })}
            {item.allergens.length > 4 && (
              <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-muted text-muted-foreground">
                +{item.allergens.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
