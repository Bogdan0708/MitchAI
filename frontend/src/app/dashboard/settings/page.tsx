'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Building2, Users, CreditCard, Bell, Shield, Palette, ExternalLink, Loader2, Zap, CheckCircle2, Smartphone, Key, AlertTriangle, Copy, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingPage } from '@/components/ui/loading-spinner'
import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/contexts/theme-context'
import { cn, formatCurrency } from '@/lib/utils'
import { api } from '@/lib/api'
import { toast } from 'sonner'

// ============================================================================
// TYPES
// ============================================================================

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

interface TwoFAStatus {
  enabled: boolean
}

interface TwoFASetup {
  qr_code: string
  secret: string
  backup_codes: string[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

const tabs = [
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
]

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  past_due: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  canceled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SettingsPage() {
  const { tenant, user } = useAuth()
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState('business')
  const [isSaving, setIsSaving] = useState(false)

  // Billing state
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null)
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([])
  const [isLoadingBilling, setIsLoadingBilling] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)

  // 2FA state
  const [twoFAStatus, setTwoFAStatus] = useState<TwoFAStatus | null>(null)
  const [twoFASetup, setTwoFASetup] = useState<TwoFASetup | null>(null)
  const [isLoading2FA, setIsLoading2FA] = useState(false)
  const [twoFAToken, setTwoFAToken] = useState('')
  const [disablePassword, setDisablePassword] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

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

  const fetch2FAStatus = useCallback(async () => {
    try {
      const response = await api.get2FAStatus()
      if (response.data) setTwoFAStatus(response.data)
    } catch (err) {
      console.error('Failed to fetch 2FA status:', err)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'billing') {
      fetchBillingInfo()
    } else if (activeTab === 'security') {
      fetch2FAStatus()
    }
  }, [activeTab, fetchBillingInfo, fetch2FAStatus])

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleSave = async () => {
    setIsSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    toast.success('Settings saved')
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

  // 2FA Handlers
  const handleSetup2FA = async () => {
    setIsLoading2FA(true)
    try {
      const response = await api.setup2FA()
      if (response.data) {
        setTwoFASetup(response.data)
        toast.success('Scan the QR code with your authenticator app')
      }
    } catch (err) {
      console.error('Failed to setup 2FA:', err)
      toast.error('Failed to setup 2FA')
    } finally {
      setIsLoading2FA(false)
    }
  }

  const handleVerify2FA = async () => {
    if (twoFAToken.length < 6) {
      toast.error('Please enter a valid 6-digit code')
      return
    }
    setIsLoading2FA(true)
    try {
      const response = await api.verify2FASetup(twoFAToken)
      if (response.data?.enabled) {
        setTwoFAStatus({ enabled: true })
        setTwoFASetup(null)
        setTwoFAToken('')
        toast.success('2FA enabled successfully!')
      }
    } catch (err) {
      console.error('Failed to verify 2FA:', err)
      toast.error('Invalid code. Please try again.')
    } finally {
      setIsLoading2FA(false)
    }
  }

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      toast.error('Please enter your password')
      return
    }
    setIsLoading2FA(true)
    try {
      await api.disable2FA(disablePassword)
      setTwoFAStatus({ enabled: false })
      setDisablePassword('')
      toast.success('2FA disabled')
    } catch (err) {
      console.error('Failed to disable 2FA:', err)
      toast.error('Invalid password')
    } finally {
      setIsLoading2FA(false)
    }
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (newPassword.length < 12) {
      toast.error('Password must be at least 12 characters')
      return
    }
    setIsChangingPassword(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password changed successfully')
    } catch (err) {
      console.error('Failed to change password:', err)
      toast.error('Failed to change password. Check your current password.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account and preferences"
        actions={
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        }
      />

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <Card className="w-56 h-fit shrink-0">
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

        {/* Tab Content */}
        <div className="flex-1 space-y-6">
          {/* Business Tab */}
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
                    <Input id="city" placeholder="London" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">County</Label>
                    <Input id="state" placeholder="Greater London" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">Postcode</Label>
                    <Input id="zip" placeholder="E1 6LY" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" placeholder="+44 20 1234 5678" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="contact@restaurant.com" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team Tab */}
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

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <>
              {billingError && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {billingError}
                </div>
              )}

              {isLoadingBilling ? (
                <LoadingPage message="Loading billing information..." />
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
                            {formatCurrency(billingInfo?.priceMonthly || 49)}
                            <span className="text-sm font-normal text-muted-foreground">/month</span>
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
                              (billingInfo?.usage.percentUsed || 0) > 95 ? 'bg-red-500' :
                              (billingInfo?.usage.percentUsed || 0) > 80 ? 'bg-yellow-500' : 'bg-primary'
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

                  {/* Pricing Tiers */}
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

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* 2FA Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Two-Factor Authentication
                  </CardTitle>
                  <CardDescription>
                    Add an extra layer of security to your account
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {twoFAStatus?.enabled ? (
                    // 2FA Enabled - Show disable option
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="text-green-700 dark:text-green-400 font-medium">
                          Two-factor authentication is enabled
                        </span>
                      </div>
                      <div className="space-y-2">
                        <Label>Disable 2FA</Label>
                        <p className="text-sm text-muted-foreground">
                          Enter your password to disable two-factor authentication
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder="Your password"
                            value={disablePassword}
                            onChange={(e) => setDisablePassword(e.target.value)}
                          />
                          <Button
                            variant="destructive"
                            onClick={handleDisable2FA}
                            disabled={isLoading2FA}
                          >
                            {isLoading2FA ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disable'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : twoFASetup ? (
                    // Setup in progress - Show QR code
                    <div className="space-y-4">
                      <div className="flex flex-col items-center p-4 bg-muted rounded-lg">
                        <img
                          src={twoFASetup.qr_code}
                          alt="2FA QR Code"
                          className="w-48 h-48 rounded-lg bg-white p-2"
                        />
                        <p className="text-sm text-muted-foreground mt-2">
                          Scan with Google Authenticator, Authy, or similar
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Manual Entry Code</Label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                            {twoFASetup.secret}
                          </code>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleCopyCode(twoFASetup.secret)}
                          >
                            {copiedCode === twoFASetup.secret ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Backup Codes</Label>
                        <p className="text-sm text-muted-foreground">
                          Save these codes somewhere safe. Each can only be used once.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {twoFASetup.backup_codes.map((code, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <code className="flex-1 p-2 bg-muted rounded text-sm font-mono text-center">
                                {code}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleCopyCode(code)}
                              >
                                {copiedCode === code ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Verify Code</Label>
                        <p className="text-sm text-muted-foreground">
                          Enter the 6-digit code from your authenticator app
                        </p>
                        <div className="flex gap-2">
                          <Input
                            placeholder="000000"
                            value={twoFAToken}
                            onChange={(e) => setTwoFAToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="font-mono text-center text-lg tracking-widest"
                            maxLength={6}
                          />
                          <Button onClick={handleVerify2FA} disabled={isLoading2FA || twoFAToken.length < 6}>
                            {isLoading2FA ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Enable'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // 2FA not enabled - Show setup button
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <span className="text-yellow-700 dark:text-yellow-400">
                          Two-factor authentication is not enabled
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Protect your account with an authenticator app like Google Authenticator or Authy.
                      </p>
                      <Button onClick={handleSetup2FA} disabled={isLoading2FA}>
                        {isLoading2FA ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Key className="h-4 w-4 mr-2" />
                        )}
                        Set Up 2FA
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Password Change */}
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>Update your account password</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be at least 12 characters with uppercase, lowercase, number, and special character
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                  >
                    {isChangingPassword ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Update Password
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Appearance Tab */}
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

          {/* Notifications Tab */}
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
        </div>
      </div>
    </div>
  )
}
