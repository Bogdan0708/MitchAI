'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
    title: 'AI Review Responder',
    description: 'Generate professional, on-brand responses to customer reviews in seconds. Support for Google, Yelp, TripAdvisor, and Facebook.',
    stat: '15 min → 30 sec',
    statLabel: 'per review'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: '24/7 AI Chatbot',
    description: 'Embed an intelligent chatbot on your website that answers customer questions about your menu, hours, reservations, and more.',
    stat: '24/7',
    statLabel: 'availability'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    title: 'Menu AI Enhancement',
    description: 'Transform plain menu descriptions into mouth-watering copy. AI detects allergens and suggests optimal pricing.',
    stat: '5 styles',
    statLabel: 'to choose from'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
    title: 'QR Code Ordering',
    description: 'Contactless ordering with table-specific QR codes. Customers scan, browse, and order from their phone.',
    stat: '0',
    statLabel: 'contact needed'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Smart Analytics',
    description: 'Real-time dashboards showing revenue trends, peak hours, sentiment analysis, and AI-powered business insights.',
    stat: 'Real-time',
    statLabel: 'insights'
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    title: 'Platform Integrations',
    description: 'Connect with Google Business, Yelp, delivery platforms, POS systems, and communication tools in one place.',
    stat: '16+',
    statLabel: 'integrations'
  },
]

const stats = [
  { value: '15-20', label: 'Hours Saved Weekly' },
  { value: '+0.3', label: 'Star Rating Boost' },
  { value: '90%', label: 'Response Time Reduction' },
  { value: '15-24x', label: 'Monthly ROI' },
]

const testimonials = [
  {
    quote: "Mitch AI has completely transformed how we handle reviews. What used to take me hours now takes minutes, and the responses are better than what I could write myself.",
    author: "Sarah M.",
    role: "Owner, The Corner Bistro",
    rating: 5
  },
  {
    quote: "The QR code ordering system paid for itself in the first week. Customers love it, and we've reduced order errors by 80%.",
    author: "James Wilson",
    role: "Manager, Urban Eats",
    rating: 5
  },
  {
    quote: "Finally, an AI tool built specifically for restaurants. The menu enhancement feature helped us rewrite our entire menu in an afternoon.",
    author: "Emily Chen",
    role: "Owner, Jade Kitchen",
    rating: 5
  },
]

const pricingPlans = [
  {
    name: 'Starter',
    price: 49,
    period: '/month',
    description: 'Perfect for food trucks and single locations',
    features: [
      '1 location',
      '5 team members',
      'AI review responder',
      'Basic chatbot',
      'QR ordering',
      'Email support',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: 149,
    period: '/month',
    description: 'For growing restaurants',
    features: [
      '5 locations',
      '20 team members',
      'Full AI suite',
      'Advanced chatbot',
      'Menu AI enhancement',
      'Analytics dashboard',
      'All integrations',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 499,
    period: '/month',
    description: 'For restaurant groups',
    features: [
      'Unlimited locations',
      'Unlimited team members',
      'Everything in Professional',
      'Voice AI (phone orders)',
      'White-label option',
      'API access',
      'Dedicated CSM',
      'Custom integrations',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const [showLanding, setShowLanding] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push('/dashboard')
      } else {
        setShowLanding(true)
      }
    }
  }, [isAuthenticated, isLoading, router])

  if (!showLanding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-lg z-50 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xl">M</span>
              </div>
              <span className="font-bold text-xl text-foreground">Mitch AI</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground font-medium">Features</a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground font-medium">Pricing</a>
              <a href="#testimonials" className="text-muted-foreground hover:text-foreground font-medium">Testimonials</a>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-muted-foreground hover:text-foreground font-medium">
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 dark:bg-primary/20 rounded-full text-primary font-medium text-sm mb-8">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI-Powered Restaurant Management
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
            The AI Assistant That<br />
            <span className="text-primary">Pays for Itself</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
            Automate reviews, customer chat, and menu management. Save 15+ hours weekly with AI built specifically for restaurants.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-semibold text-lg shadow-lg shadow-primary/20"
            >
              Start 14-Day Free Trial
            </Link>
            <a
              href="#demo"
              className="w-full sm:w-auto px-8 py-4 bg-card text-foreground rounded-xl hover:bg-muted transition-colors font-semibold text-lg border border-border"
            >
              Watch Demo
            </a>
          </div>
          <p className="text-sm text-muted-foreground">No credit card required. Setup in under 5 minutes.</p>
        </div>

        {/* Dashboard Preview */}
        <div className="max-w-6xl mx-auto mt-16">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border">
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10 pointer-events-none"></div>
            <div className="bg-card p-2 flex items-center gap-2 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="flex-1 text-center text-xs text-muted-foreground">app.mitch-ai.com</div>
            </div>
            <div className="bg-muted h-[400px] sm:h-[500px] flex items-center justify-center">
              <div className="text-muted-foreground text-center">
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                <p className="font-medium">Dashboard Preview</p>
                <p className="text-sm">Interactive demo coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl sm:text-5xl font-bold text-primary-foreground mb-2">{stat.value}</div>
                <div className="text-primary-foreground/70">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Everything You Need to Run Smarter
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              One platform for all your customer communication and operations automation
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-card rounded-2xl p-8 border border-border hover:border-primary/50 hover:shadow-lg transition-all group"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground mb-4">{feature.description}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary">{feature.stat}</span>
                  <span className="text-muted-foreground text-sm">{feature.statLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Live in 30 Minutes
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              No technical skills needed. We handle the heavy lifting.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Sign Up', description: 'Create your account and connect your Google Business Profile in minutes.' },
              { step: '2', title: 'Customize', description: 'Set your brand voice, response tone, and chatbot personality.' },
              { step: '3', title: 'Go Live', description: 'Start automating responses and watch your ratings improve.' },
            ].map((item, index) => (
              <div key={index} className="relative text-center">
                <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-2xl mx-auto mb-6">
                  {item.step}
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-primary/30"></div>
                )}
                <h3 className="text-xl font-bold text-foreground mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Loved by Restaurant Owners
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-card rounded-2xl p-8 border border-border">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-muted-foreground mb-6 italic">&quot;{testimonial.quote}&quot;</p>
                <div>
                  <div className="font-semibold text-foreground">{testimonial.author}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start free, upgrade when you are ready. No hidden fees.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`rounded-2xl p-8 ${
                  plan.highlighted
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary ring-offset-4 ring-offset-background'
                    : 'bg-card border border-border'
                }`}
              >
                {plan.highlighted && (
                  <div className="inline-block px-3 py-1 bg-primary-foreground/20 rounded-full text-sm font-medium mb-4 text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <h3 className={`text-xl font-bold mb-2 ${plan.highlighted ? 'text-primary-foreground' : 'text-foreground'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-4 ${plan.highlighted ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {plan.description}
                </p>
                <div className="mb-6">
                  <span className={`text-4xl font-bold ${plan.highlighted ? 'text-primary-foreground' : 'text-foreground'}`}>
                    ${plan.price}
                  </span>
                  <span className={plan.highlighted ? 'text-primary-foreground/70' : 'text-muted-foreground'}>{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <svg className={`w-5 h-5 ${plan.highlighted ? 'text-primary-foreground/70' : 'text-primary'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={plan.highlighted ? 'text-primary-foreground/90' : 'text-muted-foreground'}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={`block w-full py-3 rounded-xl font-semibold text-center transition-colors ${
                    plan.highlighted
                      ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-6">
            Ready to Save 15+ Hours Every Week?
          </h2>
          <p className="text-xl text-primary-foreground/70 mb-8">
            Join hundreds of restaurants already using Mitch AI to automate their operations.
          </p>
          <Link
            href="/register"
            className="inline-block px-8 py-4 bg-primary-foreground text-primary rounded-xl hover:bg-primary-foreground/90 transition-colors font-semibold text-lg"
          >
            Start Your Free Trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-900 dark:bg-slate-950">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-xl">M</span>
                </div>
                <span className="font-bold text-xl text-white">Mitch AI</span>
              </div>
              <p className="text-slate-400">
                AI-powered restaurant management platform
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-12 pt-8 text-center text-slate-400">
            <p>&copy; 2026 Mitch AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
