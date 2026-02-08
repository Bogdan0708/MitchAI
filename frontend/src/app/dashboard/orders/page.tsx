'use client'

import { useState } from 'react'
import { MoreVertical, Loader2, Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingPage } from '@/components/ui/loading-spinner'
import { SearchInput } from '@/components/ui/search-input'
import { OrderStatusBadge } from '@/components/ui/status-badge'
import { formatCurrency, formatTime } from '@/lib/utils'
import { useOrders, useUpdateOrderStatus } from '@/hooks/use-orders'

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export default function OrdersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined)

  // TanStack Query hooks
  const { data: ordersData, isLoading, error, refetch, isFetching } = useOrders({ 
    status: selectedStatus,
    limit: 50 
  })
  const updateStatus = useUpdateOrderStatus()

  // Map API response to display format
  const orders = ordersData?.items?.map((order: any) => ({
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
  })) || []

  // Filter by search
  const filteredOrders = orders.filter((order: any) => {
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.customer.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const handleStatusUpdate = (orderId: string, newStatus: string) => {
    updateStatus.mutate({ id: orderId, status: newStatus })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Manage and track customer orders"
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
        }
      />

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
          Failed to load orders. Please try again.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search orders..."
          className="max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant={!selectedStatus ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedStatus(undefined)}
          >
            All
          </Button>
          {Object.entries(statusLabels).map(([key, label]) => (
            <Button
              key={key}
              variant={selectedStatus === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus(selectedStatus === key ? undefined : key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {isLoading ? (
          <LoadingPage message="Loading orders..." />
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No orders found"
            description={selectedStatus 
              ? 'Try a different status filter' 
              : 'Orders will appear here when customers place them'
            }
            action={selectedStatus ? {
              label: 'Clear filters',
              onClick: () => setSelectedStatus(undefined),
            } : undefined}
          />
        ) : (
          filteredOrders.map((order: any) => (
            <Card key={order.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">{order.id}</span>
                        <OrderStatusBadge status={order.status} />
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
                  {order.items.map((item: any, i: number) => (
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
                      onClick={() => handleStatusUpdate(order.id, 'preparing')}
                      disabled={updateStatus.isPending}
                    >
                      {updateStatus.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Confirm Order
                    </Button>
                  )}
                  {order.status === 'preparing' && (
                    <Button
                      size="sm"
                      onClick={() => handleStatusUpdate(order.id, 'ready')}
                      disabled={updateStatus.isPending}
                    >
                      {updateStatus.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Mark Ready
                    </Button>
                  )}
                  {order.status === 'ready' && (
                    <Button
                      size="sm"
                      onClick={() => handleStatusUpdate(order.id, 'delivered')}
                      disabled={updateStatus.isPending}
                    >
                      {updateStatus.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Mark Delivered
                    </Button>
                  )}
                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusUpdate(order.id, 'cancelled')}
                      disabled={updateStatus.isPending}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
