'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

// Wizard Steps
type Step = 'business' | 'plan' | 'location' | 'complete'

interface OnboardingData {
  // Business details
  businessName: string
  slug: string
  contactEmail: string
  contactPhone: string
  businessType: string

  // Plan selection
  selectedPlan: 'starter' | 'professional' | 'enterprise'
  billingInterval: 'monthly' | 'yearly'

  // First location
  locationName: string
  address: string
  city: string
  state: string
  postalCode: string
  country: string
  skipLocation: boolean
}

const STEPS: { id: Step; title: string; description: string }[] = [
  { id: 'business', title: 'Business Details', description: 'Tell us about your business' },
  { id: 'plan', title: 'Choose Your Plan', description: 'Select the best plan for your needs' },
  { id: 'location', title: 'First Location', description: 'Add your first location' },
  { id: 'complete', title: 'All Set!', description: 'You\'re ready to go' },
]

const PLANS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    priceMonthly: 49,
    priceYearly: 490,
    description: 'Perfect for small restaurants getting started',
    features: [
      'AI Menu Descriptions',
      'Basic Review Monitoring',
      'Up to 50 menu items',
      '1 Location',
      'Email Support',
    ],
    highlighted: false,
  },
  {
    id: 'professional' as const,
    name: 'Professional',
    priceMonthly: 149,
    priceYearly: 1490,
    description: 'For growing restaurants with multiple needs',
    features: [
      'Everything in Starter',
      'AI Chat Assistant',
      'Advanced Analytics',
      'Unlimited menu items',
      'Up to 3 Locations',
      'Priority Support',
      'Review Response AI',
    ],
    highlighted: true,
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    priceMonthly: 499,
    priceYearly: 4990,
    description: 'For restaurant groups and franchises',
    features: [
      'Everything in Professional',
      'Unlimited Locations',
      'Custom Integrations',
      'Dedicated Account Manager',
      'Custom AI Training',
      'SLA Guarantee',
      'White-label Options',
    ],
    highlighted: false,
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, tenant, isLoading: authLoading, isAuthenticated } = useAuth()

  const [currentStep, setCurrentStep] = useState<Step>('business')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)

  const [data, setData] = useState<OnboardingData>({
    businessName: '',
    slug: '',
    contactEmail: '',
    contactPhone: '',
    businessType: 'restaurant',
    selectedPlan: 'professional',
    billingInterval: 'monthly',
    locationName: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    skipLocation: false,
  })

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  // Pre-fill data from tenant if available
  useEffect(() => {
    if (tenant && user) {
      setData(prev => ({
        ...prev,
        businessName: tenant.businessName || prev.businessName,
        contactEmail: user.email || prev.contactEmail,
      }))
    }
  }, [tenant, user])

  // Auto-generate slug from business name
  useEffect(() => {
    if (data.businessName && !data.slug) {
      const generatedSlug = data.businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 63)
      setData(prev => ({ ...prev, slug: generatedSlug }))
    }
  }, [data.businessName, data.slug])

  // Check slug availability (debounced)
  useEffect(() => {
    if (!data.slug || data.slug.length < 3) {
      setSlugAvailable(null)
      return
    }

    const timer = setTimeout(async () => {
      setCheckingSlug(true)
      try {
        const response = await api.checkSlugAvailability(data.slug)
        setSlugAvailable(response.data?.available ?? false)
      } catch {
        setSlugAvailable(null)
      } finally {
        setCheckingSlug(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [data.slug])

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }))
    setError('')
  }

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  const goToStep = (step: Step) => {
    setCurrentStep(step)
    setError('')
  }

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  const validateBusinessStep = (): boolean => {
    if (!data.businessName.trim()) {
      setError('Business name is required')
      return false
    }
    if (!data.slug || data.slug.length < 3) {
      setError('Business URL must be at least 3 characters')
      return false
    }
    if (slugAvailable === false) {
      setError('This business URL is already taken')
      return false
    }
    if (!data.contactEmail.trim()) {
      setError('Contact email is required')
      return false
    }
    return true
  }

  const handleBusinessNext = () => {
    if (validateBusinessStep()) {
      nextStep()
    }
  }

  const handlePlanNext = () => {
    nextStep()
  }

  const handleLocationNext = () => {
    if (!data.skipLocation) {
      if (!data.locationName.trim()) {
        setError('Location name is required')
        return
      }
      if (!data.address.trim() || !data.city.trim()) {
        setError('Address and city are required')
        return
      }
    }
    nextStep()
  }

  const completeOnboarding = async () => {
    setIsLoading(true)
    setError('')

    try {
      await api.completeOnboarding({
        businessName: data.businessName,
        slug: data.slug,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        businessType: data.businessType,
        pricingTier: data.selectedPlan,
        billingInterval: data.billingInterval,
        firstLocation: data.skipLocation ? undefined : {
          name: data.locationName,
          address: data.address,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: data.country,
        },
      })

      // Navigate to dashboard
      router.push('/dashboard?welcome=true')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding')
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => index < currentStepIndex && goToStep(step.id)}
                  disabled={index > currentStepIndex}
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium transition-colors
                    ${index === currentStepIndex
                      ? 'bg-primary text-primary-foreground'
                      : index < currentStepIndex
                        ? 'bg-primary/20 text-primary cursor-pointer hover:bg-primary/30'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }
                  `}
                >
                  {index < currentStepIndex ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </button>
                {index < STEPS.length - 1 && (
                  <div className={`w-16 h-1 mx-2 rounded ${index < currentStepIndex ? 'bg-primary/40' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <h2 className="text-lg font-semibold">{STEPS[currentStepIndex].title}</h2>
            <p className="text-sm text-muted-foreground">{STEPS[currentStepIndex].description}</p>
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 'business' && (
          <Card>
            <CardHeader>
              <CardTitle>Tell us about your business</CardTitle>
              <CardDescription>
                This information helps us customize your experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  placeholder="Mitch's Kitchen"
                  value={data.businessName}
                  onChange={e => updateData({ businessName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Business URL *</Label>
                <div className="flex items-center">
                  <span className="text-sm text-muted-foreground mr-2">mitchs.ai/</span>
                  <div className="flex-1 relative">
                    <Input
                      id="slug"
                      placeholder="mitchs-kitchen"
                      value={data.slug}
                      onChange={e => updateData({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      className="pr-8"
                    />
                    {checkingSlug && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                      </div>
                    )}
                    {!checkingSlug && slugAvailable === true && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {!checkingSlug && slugAvailable === false && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  This will be your unique URL for customer-facing features
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="contact@restaurant.com"
                    value={data.contactEmail}
                    onChange={e => updateData({ contactEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={data.contactPhone}
                    onChange={e => updateData({ contactPhone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessType">Business Type</Label>
                <select
                  id="businessType"
                  value={data.businessType}
                  onChange={e => updateData({ businessType: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="restaurant">Restaurant</option>
                  <option value="cafe">Cafe / Coffee Shop</option>
                  <option value="bar">Bar / Pub</option>
                  <option value="food_truck">Food Truck</option>
                  <option value="catering">Catering</option>
                  <option value="bakery">Bakery</option>
                  <option value="hotel_restaurant">Hotel Restaurant</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button onClick={handleBusinessNext}>
                Continue
                <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </CardFooter>
          </Card>
        )}

        {currentStep === 'plan' && (
          <div className="space-y-6">
            {/* Billing Toggle */}
            <div className="flex items-center justify-center space-x-4">
              <span className={data.billingInterval === 'monthly' ? 'font-medium' : 'text-muted-foreground'}>
                Monthly
              </span>
              <button
                onClick={() => updateData({ billingInterval: data.billingInterval === 'monthly' ? 'yearly' : 'monthly' })}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${data.billingInterval === 'yearly' ? 'bg-primary' : 'bg-muted'}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${data.billingInterval === 'yearly' ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
              <span className={data.billingInterval === 'yearly' ? 'font-medium' : 'text-muted-foreground'}>
                Yearly
                <span className="ml-1 text-xs text-green-600 font-medium">Save 17%</span>
              </span>
            </div>

            {/* Plans Grid */}
            <div className="grid md:grid-cols-3 gap-6">
              {PLANS.map(plan => (
                <Card
                  key={plan.id}
                  className={`
                    relative cursor-pointer transition-all
                    ${data.selectedPlan === plan.id
                      ? 'ring-2 ring-primary shadow-lg'
                      : 'hover:shadow-md'
                    }
                    ${plan.highlighted ? 'border-primary' : ''}
                  `}
                  onClick={() => updateData({ selectedPlan: plan.id })}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {plan.name}
                      {data.selectedPlan === plan.id && (
                        <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <span className="text-3xl font-bold">
                        ${data.billingInterval === 'monthly' ? plan.priceMonthly : Math.round(plan.priceYearly / 12)}
                      </span>
                      <span className="text-muted-foreground">/month</span>
                      {data.billingInterval === 'yearly' && (
                        <p className="text-xs text-muted-foreground">
                          ${plan.priceYearly}/year billed annually
                        </p>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start text-sm">
                          <svg className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm text-center">
                {error}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={prevStep}>
                <svg className="mr-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Button>
              <Button onClick={handlePlanNext}>
                Continue
                <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'location' && (
          <Card>
            <CardHeader>
              <CardTitle>Add Your First Location</CardTitle>
              <CardDescription>
                Set up your primary location. You can add more locations later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                <input
                  type="checkbox"
                  id="skipLocation"
                  checked={data.skipLocation}
                  onChange={e => updateData({ skipLocation: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="skipLocation" className="text-sm cursor-pointer">
                  Skip for now - I'll add locations later
                </Label>
              </div>

              {!data.skipLocation && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="locationName">Location Name *</Label>
                    <Input
                      id="locationName"
                      placeholder="Main Street Location"
                      value={data.locationName}
                      onChange={e => updateData({ locationName: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address *</Label>
                    <Input
                      id="address"
                      placeholder="123 Main Street"
                      value={data.address}
                      onChange={e => updateData({ address: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        placeholder="New York"
                        value={data.city}
                        onChange={e => updateData({ city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State/Province</Label>
                      <Input
                        id="state"
                        placeholder="NY"
                        value={data.state}
                        onChange={e => updateData({ state: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Postal Code</Label>
                      <Input
                        id="postalCode"
                        placeholder="10001"
                        value={data.postalCode}
                        onChange={e => updateData({ postalCode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <select
                        id="country"
                        value={data.country}
                        onChange={e => updateData({ country: e.target.value })}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                        <option value="UK">United Kingdom</option>
                        <option value="AU">Australia</option>
                        <option value="DE">Germany</option>
                        <option value="FR">France</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={prevStep}>
                <svg className="mr-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Button>
              <Button onClick={handleLocationNext}>
                Continue
                <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </CardFooter>
          </Card>
        )}

        {currentStep === 'complete' && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <CardTitle className="text-2xl">You're All Set!</CardTitle>
              <CardDescription className="text-base">
                Welcome to Mitch's AI Hospitality Platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="bg-muted rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Your Setup Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Business:</span>
                  <span className="font-medium">{data.businessName}</span>
                  <span className="text-muted-foreground">Plan:</span>
                  <span className="font-medium capitalize">{data.selectedPlan} ({data.billingInterval})</span>
                  <span className="text-muted-foreground">URL:</span>
                  <span className="font-medium">mitchs.ai/{data.slug}</span>
                  {!data.skipLocation && (
                    <>
                      <span className="text-muted-foreground">Location:</span>
                      <span className="font-medium">{data.locationName}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">What's Next?</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium mr-2 mt-0.5">1</span>
                    Add your menu items and let AI enhance descriptions
                  </li>
                  <li className="flex items-start">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium mr-2 mt-0.5">2</span>
                    Connect your review platforms for monitoring
                  </li>
                  <li className="flex items-start">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium mr-2 mt-0.5">3</span>
                    Set up your AI chat assistant preferences
                  </li>
                  <li className="flex items-start">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium mr-2 mt-0.5">4</span>
                    Start receiving insights and recommendations
                  </li>
                </ul>
              </div>

              <p className="text-sm text-muted-foreground text-center">
                Your 14-day free trial starts now. No credit card required.
              </p>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={prevStep}>
                <svg className="mr-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Button>
              <Button onClick={completeOnboarding} isLoading={isLoading}>
                Go to Dashboard
                <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  )
}
