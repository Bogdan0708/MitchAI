'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { api, QRMenuData } from '@/lib/api'

interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  imageUrl?: string
  allergens?: string[]
  isAvailable: boolean
}

interface Category {
  id: string
  name: string
  items: MenuItem[]
}

interface CartItem {
  item: MenuItem
  quantity: number
  notes?: string
}

interface MenuState {
  businessName: string
  locationName: string
  categories: Category[]
}

export default function QROrderPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  // Handle catch-all route - slug is an array
  const slugArray = params.slug as string[] | undefined
  const slug = slugArray?.[0] || ''
  const locationId = searchParams.get('location') || undefined

  const [menu, setMenu] = useState<MenuState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [showCart, setShowCart] = useState(false)
  const [showItemModal, setShowItemModal] = useState<MenuItem | null>(null)
  const [itemQuantity, setItemQuantity] = useState(1)
  const [itemNotes, setItemNotes] = useState('')
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [showCheckout, setShowCheckout] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [estimatedTime, setEstimatedTime] = useState(15)

  // Fetch menu from API
  const fetchMenu = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await api.getQRMenu(slug, locationId)
      if (response.data) {
        const menuData = response.data
        const mappedMenu: MenuState = {
          businessName: menuData.businessName,
          locationName: menuData.locationName || 'Main Location',
          categories: menuData.categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            items: cat.items.map(item => ({
              id: item.id,
              name: item.name,
              description: item.description,
              price: item.price,
              imageUrl: item.imageUrl,
              allergens: item.allergens,
              isAvailable: item.isAvailable,
            })),
          })),
        }
        setMenu(mappedMenu)
        if (mappedMenu.categories.length > 0) {
          setActiveCategory(mappedMenu.categories[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to fetch menu:', err)
      setError('Failed to load menu. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [slug, locationId])

  // Fetch menu on mount
  useEffect(() => {
    fetchMenu()
  }, [fetchMenu])

  const cartTotal = cart.reduce((sum, item) => sum + (item.item.price * item.quantity), 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const addToCart = () => {
    if (!showItemModal) return

    const existingIndex = cart.findIndex(c => c.item.id === showItemModal.id)

    if (existingIndex >= 0) {
      const newCart = [...cart]
      newCart[existingIndex].quantity += itemQuantity
      if (itemNotes) newCart[existingIndex].notes = itemNotes
      setCart(newCart)
    } else {
      setCart([...cart, { item: showItemModal, quantity: itemQuantity, notes: itemNotes }])
    }

    setShowItemModal(null)
    setItemQuantity(1)
    setItemNotes('')
  }

  const updateCartQuantity = (itemId: string, delta: number) => {
    const newCart = cart.map(c => {
      if (c.item.id === itemId) {
        const newQty = c.quantity + delta
        return newQty > 0 ? { ...c, quantity: newQty } : null
      }
      return c
    }).filter(Boolean) as CartItem[]
    setCart(newCart)
  }

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(c => c.item.id !== itemId))
  }

  const placeOrder = async () => {
    if (isSubmitting || cart.length === 0) return

    setIsSubmitting(true)
    setError(null)

    try {
      const orderRequest = {
        locationId: locationId || '',
        tableNumber: tableNumber || undefined,
        customerName: customerName || undefined,
        items: cart.map(c => ({
          menuItemId: c.item.id,
          quantity: c.quantity,
          notes: c.notes,
        })),
        paymentMethod: 'pay_at_counter' as const,
      }

      const response = await api.submitQROrder(slug, orderRequest)

      if (response.data) {
        setOrderNumber(response.data.orderNumber)
        setEstimatedTime(response.data.estimatedTime || 15)
        setOrderPlaced(true)
        setCart([])
        setShowCheckout(false)
        setShowCart(false)
      }
    } catch (err) {
      console.error('Failed to place order:', err)
      setError('Failed to place order. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h1>
          <p className="text-gray-600 mb-6">Thank you for your order</p>

          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="text-sm text-gray-500 mb-1">Order Number</div>
            <div className="text-2xl font-bold text-indigo-600">{orderNumber}</div>
          </div>

          <div className="space-y-2 text-sm text-gray-600 mb-6">
            <div className="flex justify-between">
              <span>Estimated Time:</span>
              <span className="font-medium">{estimatedTime}-{estimatedTime + 5} minutes</span>
            </div>
            {tableNumber && (
              <div className="flex justify-between">
                <span>Table:</span>
                <span className="font-medium">{tableNumber}</span>
              </div>
            )}
          </div>

          <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-700">
            We will bring your order to you when ready. Please show this screen to the server.
          </div>

          <button
            onClick={() => setOrderPlaced(false)}
            className="mt-6 text-indigo-600 font-medium"
          >
            Order More Items
          </button>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !menu) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Menu</h1>
          <p className="text-gray-600 mb-6">{error || 'The menu could not be found. Please check the URL and try again.'}</p>
          <button
            onClick={fetchMenu}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{menu.businessName}</h1>
              <p className="text-sm text-gray-500">{menu.locationName}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                Open Now
              </span>
            </div>
          </div>
        </div>

        {/* Category tabs */}
        <div className="border-t overflow-x-auto">
          <div className="max-w-lg mx-auto px-4">
            <div className="flex gap-1 py-2">
              {menu.categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeCategory === cat.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {menu.categories.map(category => (
          <div
            key={category.id}
            id={category.id}
            className={activeCategory === category.id ? 'block' : 'hidden'}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4">{category.name}</h2>
            <div className="space-y-3">
              {category.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => item.isAvailable && setShowItemModal(item)}
                  disabled={!item.isAvailable}
                  className={`w-full bg-white rounded-xl p-4 shadow-sm text-left transition-all ${
                    item.isAvailable
                      ? 'hover:shadow-md active:scale-[0.99]'
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex gap-4">
                    {item.imageUrl && (
                      <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                        <span className="font-bold text-indigo-600">${item.price.toFixed(2)}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                      {item.allergens && item.allergens.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {item.allergens.map(allergen => (
                            <span key={allergen} className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                              {allergen}
                            </span>
                          ))}
                        </div>
                      )}
                      {!item.isAvailable && (
                        <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                          Currently Unavailable
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{showItemModal.name}</h2>
                  <p className="text-lg font-bold text-indigo-600">${showItemModal.price.toFixed(2)}</p>
                </div>
                <button
                  onClick={() => setShowItemModal(null)}
                  className="p-2 -mt-2 -mr-2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-gray-600 mb-4">{showItemModal.description}</p>

              {showItemModal.allergens && showItemModal.allergens.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">Contains:</div>
                  <div className="flex flex-wrap gap-2">
                    {showItemModal.allergens.map(allergen => (
                      <span key={allergen} className="text-sm px-3 py-1 bg-orange-100 text-orange-700 rounded-full">
                        {allergen}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Special Instructions</label>
                <textarea
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Any allergies or preferences?"
                  className="w-full p-3 border rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                  className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="text-2xl font-bold text-gray-900 w-12 text-center">{itemQuantity}</span>
                <button
                  onClick={() => setItemQuantity(itemQuantity + 1)}
                  className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              <button
                onClick={addToCart}
                className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Add to Order - ${(showItemModal.price * itemQuantity).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Panel */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Your Order</h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="p-2 -mt-2 -mr-2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-500">Your cart is empty</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map(cartItem => (
                      <div key={cartItem.item.id} className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium text-gray-900">{cartItem.item.name}</h3>
                            <span className="font-semibold text-gray-900">
                              ${(cartItem.item.price * cartItem.quantity).toFixed(2)}
                            </span>
                          </div>
                          {cartItem.notes && (
                            <p className="text-sm text-gray-500 mt-1">{cartItem.notes}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <button
                              onClick={() => updateCartQuantity(cartItem.item.id, -1)}
                              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                            </button>
                            <span className="font-medium text-gray-900">{cartItem.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(cartItem.item.id, 1)}
                              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                            <button
                              onClick={() => removeFromCart(cartItem.item.id)}
                              className="ml-auto text-red-500 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 space-y-2 mb-6">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Tax</span>
                      <span>${(cartTotal * 0.08).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                      <span>Total</span>
                      <span>${(cartTotal * 1.08).toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => { setShowCart(false); setShowCheckout(true); }}
                    className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                  >
                    Proceed to Checkout
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Panel */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Checkout</h2>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="p-2 -mt-2 -mr-2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full p-3 border rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Table Number (Optional)</label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="e.g., 12"
                    className="w-full p-3 border rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="font-medium text-gray-900 mb-3">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  {cart.map(cartItem => (
                    <div key={cartItem.item.id} className="flex justify-between">
                      <span className="text-gray-600">{cartItem.quantity}x {cartItem.item.name}</span>
                      <span className="text-gray-900">${(cartItem.item.price * cartItem.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax (8%)</span>
                      <span>${(cartTotal * 0.08).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 pt-2">
                      <span>Total</span>
                      <span>${(cartTotal * 1.08).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-blue-700">
                    Payment will be collected at the counter when your order is ready.
                  </p>
                </div>
              </div>

              <button
                onClick={placeOrder}
                disabled={!customerName.trim() || isSubmitting}
                className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Placing Order...
                  </>
                ) : (
                  `Place Order - $${(cartTotal * 1.08).toFixed(2)}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Cart Button */}
      {cart.length > 0 && !showCart && !showCheckout && !showItemModal && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-40">
          <div className="max-w-lg mx-auto p-4">
            <button
              onClick={() => setShowCart(true)}
              className="w-full flex items-center justify-between py-4 px-6 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="bg-white/20 px-2.5 py-1 rounded-lg font-bold">{cartCount}</span>
                <span className="font-semibold">View Order</span>
              </div>
              <span className="font-bold">${cartTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {/* Add custom animation */}
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
