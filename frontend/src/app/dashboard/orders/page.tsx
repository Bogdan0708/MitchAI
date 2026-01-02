'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Filter, MoreVertical, Clock, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency, formatTime } from '@/lib/utils'
import { api } from '@/lib/api'

interface OrderItem {
  name: string
  quantity: number
  price: number
}

interface Order {
  id: string
  customer: string
  items: OrderItem[]
  total: number
  status: string
  createdAt: string
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'; icon: React.ReactNode }> = {
  pending: { label: 'Pending', variant: 'warning', icon: <Clock className="h-3 w-3" /> },
  preparing: { label: 'Preparing', variant: 'default', icon: <Clock className="h-3 w-3" /> },
  ready: { label: 'Ready', variant: 'success', icon: <CheckCircle className="h-3 w-3" /> },
  delivered: { label: 'Delivered', variant: 'secondary', icon: <CheckCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const params: { status?: string; page?: number; limit?: number } = { limit: 50 }
      if (selectedStatus) params.status = selectedStatus

      const response = await api.getOrders(params)
      if (response.items) {
        // Map API response to our Order interface
        const mappedOrders: Order[] = response.items.map((order: any) => ({
          id: order.orderNumber || order.id,
          customer: order.customerName || 'Guest',
          items: order.items?.map((item: any) => ({
            name: item.menuItemName || item.name,
            quantity: item.quantity,
            price: item.unitPrice || item.price,
          })) || [],
          total: order.totalAmount || order.total,
          status: order.status,
          createdAt: order.createdAt,
        }))
        setOrders(mappedOrders)
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err)
      setError('Failed to load orders. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [selectedStatus])

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setIsUpdating(orderId)
      await api.updateOrderStatus(orderId, newStatus)
      // Update local state
      setOrders(prev => prev.map(order =>
        order.id === orderId ? { ...order, status: newStatus } : order
      ))
    } catch (err) {
      console.error('Failed to update order status:', err)
      setError('Failed to update order. Please try again.')
    } finally {
      setIsUpdating(null)
    }
  }

  // Fetch on mount and when status filter changes
  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.customer.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Manage and track customer orders</p>
        </div>
        <Button variant="outline" onClick={fetchOrders} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {Object.entries(statusConfig).map(([key, config]) => (
            <Button
              key={key}
              variant={selectedStatus === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus(selectedStatus === key ? null : key)}
            >
              {config.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Loading orders...</p>
            </CardContent>
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No orders found</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {selectedStatus ? 'Try a different status filter' : 'Orders will appear here when customers place them'}
              </p>
            </CardContent>
          </Card>
        ) : null}
        {!isLoading && filteredOrders.map((order) => (
          <Card key={order.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{order.id}</span>
                      <Badge variant={statusConfig[order.status].variant} className="gap-1">
                        {statusConfig[order.status].icon}
                        {statusConfig[order.status].label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {order.customer} • {formatTime(order.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{formatCurrency(order.total)}</span>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.quantity}x {item.name}
                    </span>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                {order.status === 'pending' && (
                  <Button
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                    disabled={isUpdating === order.id}
                  >
                    {isUpdating === order.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                    Confirm Order
                  </Button>
                )}
                {order.status === 'preparing' && (
                  <Button
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'ready')}
                    disabled={isUpdating === order.id}
                  >
                    {isUpdating === order.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                    Mark Ready
                  </Button>
                )}
                {order.status === 'ready' && (
                  <Button
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'delivered')}
                    disabled={isUpdating === order.id}
                  >
                    {isUpdating === order.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
                    Mark Delivered
                  </Button>
                )}
                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateOrderStatus(order.id, 'cancelled')}
                    disabled={isUpdating === order.id}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
