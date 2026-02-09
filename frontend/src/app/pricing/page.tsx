'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, X, HelpCircle, Zap, Shield, HeadphonesIcon, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ============================================================================
// PRICING DATA
// ============================================================================

const plans = [
  {
    name: 'Starter',
    description: 'Perfect for single-location restaurants getting started with AI',
    monthlyPrice: 49,
    yearlyPrice: 490, // ~2 months free
    popular: false,
    cta: 'Start Free Trial',
    ctaLink: '/register?plan=starter',
    limits: {
      locations: '1 location',
      users: '5 team members',
      menuItems: '100 menu items',
      aiCredits: '500 AI credits/mo',
      overageRate: '£0.02/credit overage',
    },
    features: [
      { name: 'AI Review Responder', included: true },
      { name: 'Menu AI Enhancement', included: true },
      { name: '24/7 AI Chatbot', included: true },
      { name: 'QR Code Ordering', included: true },
      { name: 'Basic Analytics', included: true },
      { name: 'Email Support', included: true },
      { name: 'Social Media AI', included: false },
      { name: 'Voice AI Assistant', included: false },
      { name: 'Custom Integrations', included: false },
      { name: 'Dedicated Account Manager', included: false },
    ],
  },
  {
    name: 'Professional',
    description: 'For growing restaurants with multiple locations',
    monthlyPrice: 149,
    yearlyPrice: 1490, // ~2 months free
    popular: true,
    cta: 'Start Free Trial',
    ctaLink: '/register?plan=professional',
    limits: {
      locations: '5 locations',
      users: '20 team members',
      menuItems: '500 menu items',
      aiCredits: '2,000 AI credits/mo',
      overageRate: '£0.015/credit overage',
    },
    features: [
      { name: 'AI Review Responder', included: true },
      { name: 'Menu AI Enhancement', included: true },
      { name: '24/7 AI Chatbot', included: true },
      { name: 'QR Code Ordering', included: true },
      { name: 'Advanced Analytics', included: true },
      { name: 'Priority Support', included: true },
      { name: 'Social Media AI', included: true },
      { name: 'Voice AI Assistant', included: false },
      { name: 'Custom Integrations', included: true },
      { name: 'Dedicated Account Manager', included: false },
    ],
  },
  {
    name: 'Enterprise',
    description: 'For restaurant groups and franchises',
    monthlyPrice: 499,
    yearlyPrice: 4990, // ~2 months free
    popular: false,
    cta: 'Contact Sales',
    ctaLink: '/contact?plan=enterprise',
    limits: {
      locations: 'Unlimited locations',
      users: 'Unlimited team members',
      menuItems: 'Unlimited menu items',
      aiCredits: '10,000 AI credits/mo',
      overageRate: '£0.01/credit overage',
    },
    features: [
      { name: 'AI Review Responder', included: true },
      { name: 'Menu AI Enhancement', included: true },
      { name: '24/7 AI Chatbot', included: true },
      { name: 'QR Code Ordering', included: true },
      { name: 'Enterprise Analytics', included: true },
      { name: '24/7 Phone Support', included: true },
      { name: 'Social Media AI', included: true },
      { name: 'Voice AI Assistant', included: true },
      { name: 'Custom Integrations', included: true },
      { name: 'Dedicated Account Manager', included: true },
    ],
  },
]

const faqs = [
  {
    question: 'How does the 14-day free trial work?',
    answer: 'Start with full access to all features in your chosen plan. No credit card required. At the end of 14 days, choose to subscribe or your account converts to a limited free tier.',
  },
  {
    question: 'Can I change plans later?',
    answer: 'Yes! Upgrade or downgrade anytime. When upgrading, you get immediate access to new features. When downgrading, changes take effect at your next billing cycle.',
  },
  {
    question: 'What counts as an "AI request"?',
    answer: 'Each AI-powered action counts as one request: generating a review response, enhancing a menu description, chatbot conversations, sentiment analysis, etc. Most restaurants use 200-500 requests per month.',
  },
  {
    question: 'Do you offer discounts for annual billing?',
    answer: 'Yes! Pay annually and get 2 months free (about 17% savings). All plans include the annual discount option.',
  },
  {
    question: 'What integrations are included?',
    answer: 'All plans include Google Business Profile, Square POS, and our website chatbot widget. Professional and Enterprise add delivery platforms (DoorDash, Uber Eats), social media scheduling, and custom API access.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Absolutely. We use bank-level encryption (AES-256), SOC 2 compliant infrastructure on AWS, and never share your data with third parties. Enterprise plans include additional security features like SSO and audit logs.',
  },
  {
    question: 'Can I get a refund?',
    answer: 'We offer a 30-day money-back guarantee on all plans. If you\'re not satisfied, contact us for a full refund, no questions asked.',
  },
  {
    question: 'Do you offer custom enterprise solutions?',
    answer: 'Yes! For restaurant groups with 20+ locations, we offer custom pricing, dedicated infrastructure, white-labeling, and bespoke integrations. Contact our sales team to discuss.',
  },
]

const comparisonFeatures = [
  { 
    category: 'AI Features',
    features: [
      { name: 'AI Review Responses', starter: true, professional: true, enterprise: true },
      { name: 'Menu Description AI', starter: true, professional: true, enterprise: true },
      { name: '24/7 AI Chatbot', starter: true, professional: true, enterprise: true },
      { name: 'Social Media AI', starter: false, professional: true, enterprise: true },
      { name: 'Voice AI Assistant', starter: false, professional: false, enterprise: true },
      { name: 'Custom AI Training', starter: false, professional: false, enterprise: true },
    ]
  },
  {
    category: 'Operations',
    features: [
      { name: 'QR Code Ordering', starter: true, professional: true, enterprise: true },
      { name: 'Table Management', starter: true, professional: true, enterprise: true },
      { name: 'Multi-location Dashboard', starter: false, professional: true, enterprise: true },
      { name: 'Franchise Management', starter: false, professional: false, enterprise: true },
    ]
  },
  {
    category: 'Integrations',
    features: [
      { name: 'Google Business Profile', starter: true, professional: true, enterprise: true },
      { name: 'Square POS', starter: true, professional: true, enterprise: true },
      { name: 'Delivery Platforms', starter: false, professional: true, enterprise: true },
      { name: 'Custom API Access', starter: false, professional: true, enterprise: true },
      { name: 'Webhook Integrations', starter: false, professional: true, enterprise: true },
    ]
  },
  {
    category: 'Support',
    features: [
      { name: 'Email Support', starter: true, professional: true, enterprise: true },
      { name: 'Priority Support', starter: false, professional: true, enterprise: true },
      { name: '24/7 Phone Support', starter: false, professional: false, enterprise: true },
      { name: 'Dedicated Account Manager', starter: false, professional: false, enterprise: true },
      { name: 'Onboarding Assistance', starter: false, professional: true, enterprise: true },
    ]
  },
]

// ============================================================================
// COMPONENTS
// ============================================================================

function PricingToggle({ isYearly, setIsYearly }: { isYearly: boolean; setIsYearly: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span className={cn('text-sm font-medium', !isYearly ? 'text-foreground' : 'text-muted-foreground')}>
        Monthly
      </span>
      <button
        onClick={() => setIsYearly(!isYearly)}
        className={cn(
          'relative w-14 h-7 rounded-full transition-colors',
          isYearly ? 'bg-primary' : 'bg-muted'
        )}
      >
        <span
          className={cn(
            'absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform',
            isYearly ? 'translate-x-8' : 'translate-x-1'
          )}
        />
      </button>
      <span className={cn('text-sm font-medium', isYearly ? 'text-foreground' : 'text-muted-foreground')}>
        Yearly
      </span>
      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        Save 17%
      </Badge>
    </div>
  )
}

function PricingCard({ plan, isYearly }: { plan: typeof plans[0]; isYearly: boolean }) {
  const price = isYearly ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice
  const yearlyTotal = plan.yearlyPrice
  
  return (
    <div className={cn(
      'relative rounded-2xl border bg-card p-8 shadow-sm transition-shadow hover:shadow-lg',
      plan.popular && 'border-primary shadow-md ring-1 ring-primary'
    )}>
      {plan.popular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
          Most Popular
        </Badge>
      )}
      
      <div className="mb-6">
        <h3 className="text-2xl font-bold">{plan.name}</h3>
        <p className="text-muted-foreground mt-2">{plan.description}</p>
      </div>
      
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold">£{price}</span>
          <span className="text-muted-foreground">/month</span>
        </div>
        {isYearly && (
          <p className="text-sm text-muted-foreground mt-1">
            £{yearlyTotal} billed annually
          </p>
        )}
      </div>
      
      <Link href={plan.ctaLink}>
        <Button className="w-full mb-6" variant={plan.popular ? 'default' : 'outline'} size="lg">
          {plan.cta}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </Link>
      
      <div className="space-y-4 mb-6">
        <p className="font-medium text-sm">Plan includes:</p>
        <ul className="space-y-2 text-sm">
          {Object.entries(plan.limits).map(([key, value]) => (
            <li key={key} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
              {value}
            </li>
          ))}
        </ul>
      </div>
      
      <div className="border-t pt-6 space-y-3">
        {plan.features.map((feature) => (
          <div key={feature.name} className="flex items-center gap-2 text-sm">
            {feature.included ? (
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
            ) : (
              <X className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
            )}
            <span className={cn(!feature.included && 'text-muted-foreground')}>
              {feature.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeatureComparison() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-4 font-medium">Features</th>
            <th className="p-4 text-center font-medium">Starter</th>
            <th className="p-4 text-center font-medium bg-primary/5">Professional</th>
            <th className="p-4 text-center font-medium">Enterprise</th>
          </tr>
        </thead>
        <tbody>
          {comparisonFeatures.map((category) => (
            <>
              <tr key={category.category} className="bg-muted/50">
                <td colSpan={4} className="p-3 font-semibold text-sm">
                  {category.category}
                </td>
              </tr>
              {category.features.map((feature) => (
                <tr key={feature.name} className="border-b">
                  <td className="p-4 text-sm">{feature.name}</td>
                  <td className="p-4 text-center">
                    {feature.starter ? (
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                    )}
                  </td>
                  <td className="p-4 text-center bg-primary/5">
                    {feature.professional ? (
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {feature.enterprise ? (
                      <Check className="h-5 w-5 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  
  return (
    <div className="space-y-4">
      {faqs.map((faq, index) => (
        <div key={index} className="border rounded-lg">
          <button
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="w-full flex items-center justify-between p-4 text-left font-medium hover:bg-muted/50 transition-colors"
          >
            {faq.question}
            <HelpCircle className={cn(
              'h-5 w-5 text-muted-foreground transition-transform',
              openIndex === index && 'rotate-180'
            )} />
          </button>
          {openIndex === index && (
            <div className="px-4 pb-4 text-muted-foreground">
              {faq.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)
  
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-xl font-bold text-primary">
              Mitch
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            14-day free trial • No credit card required
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Choose the plan that fits your restaurant. All plans include our core AI features.
            Upgrade or downgrade anytime.
          </p>
          <PricingToggle isYearly={isYearly} setIsYearly={setIsYearly} />
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <PricingCard key={plan.name} plan={plan} isYearly={isYearly} />
          ))}
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-2">
              <Shield className="h-8 w-8 mx-auto text-primary" />
              <p className="font-medium">Bank-level Security</p>
              <p className="text-sm text-muted-foreground">256-bit encryption</p>
            </div>
            <div className="space-y-2">
              <Zap className="h-8 w-8 mx-auto text-primary" />
              <p className="font-medium">99.9% Uptime</p>
              <p className="text-sm text-muted-foreground">Enterprise reliability</p>
            </div>
            <div className="space-y-2">
              <HeadphonesIcon className="h-8 w-8 mx-auto text-primary" />
              <p className="font-medium">Expert Support</p>
              <p className="text-sm text-muted-foreground">Real humans, fast response</p>
            </div>
            <div className="space-y-2">
              <Check className="h-8 w-8 mx-auto text-primary" />
              <p className="font-medium">30-day Guarantee</p>
              <p className="text-sm text-muted-foreground">Full refund, no questions</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Compare Plans</h2>
            <p className="text-muted-foreground">See exactly what's included in each plan</p>
          </div>
          <FeatureComparison />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">Everything you need to know about our pricing</p>
          </div>
          <FAQ />
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to transform your restaurant?</h2>
          <p className="text-lg opacity-90 mb-8">
            Join hundreds of restaurants already using Mitch to save time and delight customers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Start Free Trial
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
                Talk to Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 Mitch from Transylvania. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
