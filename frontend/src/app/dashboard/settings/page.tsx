'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Building2, Users, CreditCard, Bell, Shield, Palette, ExternalLink, Loader2, Zap, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { cn, formatCurrency } from '@/lib/utils'
import { api } from '@/lib/api'

const tabs = [
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
]

interface BillingInfo {
  tenantId: string
  tier: string
  tierDisplayName: string
  priceMonthly: number
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'suspended'
  stripeCustomerId: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  usage: {
    apiCallsThisMonth: number
    apiCallsLimit: number
    percentUsed: number
  }
}

interface PricingTier {
  name: string
  displayName: string
  priceMonthly: number
  priceYearly: number
  features: Record<string, boolean>
  limits: {
    locations: number
    users: number
    menuItems: number
    apiCalls: number
  }
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  past_due: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  canceled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function SettingsPage() {
  const { tenant, user } = useAuth()
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState('business')
  const [isSaving, setIsSaving] = useState(false)
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null)
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([])
  const [isLoadingBilling, setIsLoadingBilling] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)

  const fetchBillingInfo = useCallback(async () => {
    setIsLoadingBilling(true)
    setBillingError(null)
    try {
      const [billingRes, tiersRes] = await Promise.all([
        api.getBillingInfo(),
        api.getPricingTiers()
      ])
      if (billingRes.data) setBillingInfo(billingRes.data)
      if (tiersRes.data) setPricingTiers(tiersRes.data)
    } catch (err) {
      console.error('Failed to fetch billing info:', err)
      setBillingError('Unable to load billing information')
    } finally {
      setIsLoadingBilling(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'billing') {
      fetchBillingInfo()
    }
  }, [activeTab, fetchBillingInfo])

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
  }

  const handleUpgrade = async (tierName: string) => {
    setIsUpgrading(true)
    try {
      const response = await api.createCheckoutSession(
        tierName,
        `${window.location.origin}/dashboard/settings?billing=success`,
        `${window.location.origin}/dashboard/settings?billing=canceled`
      )
      if (response.data?.url) {
        window.location.href = response.data.url
      }
    } catch (err) {
      console.error('Failed to create checkout session:', err)
      setBillingError('Unable to start checkout. Please try again.')
    } finally {
      setIsUpgrading(false)
    }
  }

  const handleManageBilling = async () => {
    try {
      const response = await api.createPortalSession(
        `${window.location.origin}/dashboard/settings`
      )
      if (response.data?.url) {
        window.location.href = response.data.url
      }
    } catch (err) {
      console.error('Failed to create portal session:', err)
      setBillingError('Unable to open billing portal. Please try again.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Tabs */}
        <Card className="w-56 h-fit">
          <CardContent className="p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Content */}
        <div className="flex-1 space-y-6">
          {activeTab === 'business' && (
            <Card>
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>Update your business details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name</Label>
                    <Input id="businessName" defaultValue={tenant?.businessName || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">URL Slug</Label>
                    <Input id="slug" defaultValue={tenant?.slug || ''} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" placeholder="123 Main Street" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" placeholder="New York" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" placeholder="NY" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input id="zip" placeholder="10001" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" placeholder="+1 (555) 000-0000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="contact@restaurant.com" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'team' && (
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Manage your team access</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                      </div>
                    </div>
                    <Badge>Owner</Badge>
                  </div>
                  <Button variant="outline" className="w-full">
                    <Users className="h-4 w-4 mr-2" />
                    Invite Team Member
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'billing' && (
            <>
              {billingError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
                  {billingError}
                </div>
              )}

              {isLoadingBilling ? (
                <Card>
                  <CardContent className="p-8 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Current Plan */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Current Plan</CardTitle>
                      <CardDescription>Your subscription details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-semibold">{billingInfo?.tierDisplayName || 'Starter'} Plan</p>
                            <Badge className={statusColors[billingInfo?.status || 'active']}>
                              {billingInfo?.status || 'Active'}
                            </Badge>
                          </div>
                          <p className="text-2xl font-bold mt-1">
                            {formatCurrency(billingInfo?.priceMonthly || 49)}<span className="text-sm font-normal text-muted-foreground">/month</span>
                          </p>
                          {billingInfo?.currentPeriodEnd && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {billingInfo.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on {new Date(billingInfo.currentPeriodEnd).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        {billingInfo?.stripeCustomerId && (
                          <Button variant="outline" onClick={handleManageBilling}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Manage Billing
                          </Button>
                        )}
                      </div>

                      {/* Usage */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">API Usage This Month</span>
                          <span>{billingInfo?.usage.apiCallsThisMonth.toLocaleString()} / {billingInfo?.usage.apiCallsLimit.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full transition-all',
                              (billingInfo?.usage.percentUsed || 0) > 80 ? 'bg-yellow-500' :
                              (billingInfo?.usage.percentUsed || 0) > 95 ? 'bg-red-500' : 'bg-primary'
                            )}
                            style={{ width: `${Math.min(billingInfo?.usage.percentUsed || 0, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {billingInfo?.usage.percentUsed || 0}% of monthly limit used
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Available Plans */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Available Plans</CardTitle>
                      <CardDescription>Choose the plan that fits your needs</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {pricingTiers.map((tier) => {
                          const isCurrentPlan = tier.name === billingInfo?.tier
                          return (
                            <div
                              key={tier.name}
                              className={cn(
                                'p-4 rounded-lg border-2 transition-colors',
                                isCurrentPlan ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                              )}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold">{tier.displayName}</h3>
                                {isCurrentPlan && (
                                  <Badge variant="outline" className="text-primary border-primary">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Current
                                  </Badge>
                                )}
                              </div>
                              <p className="text-2xl font-bold">
                                {formatCurrency(tier.priceMonthly)}
                                <span className="text-sm font-normal text-muted-foreground">/mo</span>
                              </p>
                              <ul className="mt-4 space-y-2 text-sm">
                                <li className="flex items-center gap-2">
                                  <Zap className="h-4 w-4 text-primary" />
                                  {tier.limits.locations === Infinity ? 'Unlimited' : tier.limits.locations} location{tier.limits.locations !== 1 ? 's' : ''}
                                </li>
                                <li className="flex items-center gap-2">
                                  <Zap className="h-4 w-4 text-primary" />
                                  {tier.limits.users === Infinity ? 'Unlimited' : tier.limits.users} team member{tier.limits.users !== 1 ? 's' : ''}
                                </li>
                                <li className="flex items-center gap-2">
                                  <Zap className="h-4 w-4 text-primary" />
                                  {tier.limits.apiCalls.toLocaleString()} API calls/month
                                </li>
                                {tier.features.menu_ai && (
                                  <li className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Menu AI
                                  </li>
                                )}
                                {tier.features.social_media && (
                                  <li className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Social Media
                                  </li>
                                )}
                                {tier.features.voice_ai && (
                                  <li className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Voice AI
                                  </li>
                                )}
                              </ul>
                              <Button
                                className="w-full mt-4"
                                variant={isCurrentPlan ? 'outline' : 'default'}
                                disabled={isCurrentPlan || isUpgrading}
                                onClick={() => handleUpgrade(tier.name)}
                              >
                                {isUpgrading ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : isCurrentPlan ? (
                                  'Current Plan'
                                ) : tier.priceMonthly > (billingInfo?.priceMonthly || 0) ? (
                                  'Upgrade'
                                ) : (
                                  'Downgrade'
                                )}
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}

          {activeTab === 'appearance' && (
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <div className="flex gap-2">
                    {(['light', 'dark', 'system'] as const).map((t) => (
                      <Button
                        key={t}
                        variant={theme === t ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTheme(t)}
                        className="capitalize"
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Configure notification preferences</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Notification settings coming soon.</p>
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Manage security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Change Password</Label>
                  <div className="space-y-2">
                    <Input type="password" placeholder="Current password" />
                    <Input type="password" placeholder="New password" />
                    <Input type="password" placeholder="Confirm new password" />
                  </div>
                  <Button>Update Password</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
