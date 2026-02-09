'use client'

import Link from 'next/link'
import { 
  Star, MessageSquare, Utensils, QrCode, BarChart3, Link2, 
  Bot, Mic, Share2, ArrowRight, Check, Play,
  Clock, TrendingUp, Users, Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ============================================================================
// FEATURE DATA
// ============================================================================

const features = [
  {
    id: 'reviews',
    icon: Star,
    title: 'AI Review Responder',
    tagline: 'Turn reviews into relationships',
    description: 'Generate professional, on-brand responses to customer reviews in seconds. Our AI understands context, sentiment, and your brand voice.',
    benefits: [
      'Respond to reviews 10x faster',
      'Maintain consistent brand voice',
      'Turn negative reviews into opportunities',
      'Support for Google, Yelp, TripAdvisor, Facebook',
    ],
    stats: [
      { value: '30 sec', label: 'Average response time' },
      { value: '15 hrs', label: 'Saved per week' },
      { value: '+0.3', label: 'Star rating boost' },
    ],
    color: 'from-yellow-500 to-orange-500',
  },
  {
    id: 'chatbot',
    icon: MessageSquare,
    title: '24/7 AI Chatbot',
    tagline: 'Never miss a customer question',
    description: 'Embed an intelligent chatbot on your website that answers questions about your menu, hours, reservations, and more—even at 3am.',
    benefits: [
      'Instant answers to common questions',
      'Handles reservations and inquiries',
      'Trained on your specific menu and policies',
      'Seamless handoff to human staff when needed',
    ],
    stats: [
      { value: '24/7', label: 'Availability' },
      { value: '< 1s', label: 'Response time' },
      { value: '85%', label: 'Questions resolved' },
    ],
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'menu',
    icon: Utensils,
    title: 'Menu AI Enhancement',
    tagline: 'Make every dish irresistible',
    description: 'Transform plain menu descriptions into mouth-watering copy. AI detects allergens, suggests optimal pricing, and creates descriptions that sell.',
    benefits: [
      'Generate appetizing descriptions instantly',
      'Automatic allergen detection',
      'Multiple writing styles (casual, fine dining, etc.)',
      'Multilingual support',
    ],
    stats: [
      { value: '5', label: 'Writing styles' },
      { value: '12', label: 'Languages' },
      { value: '+15%', label: 'Menu engagement' },
    ],
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'qr',
    icon: QrCode,
    title: 'QR Code Ordering',
    tagline: 'Contactless ordering made simple',
    description: 'Generate branded QR codes for each table. Customers scan, browse your menu, and order directly from their phone. No app download required.',
    benefits: [
      'Table-specific QR codes',
      'Real-time order tracking',
      'Reduce wait times',
      'Collect customer feedback instantly',
    ],
    stats: [
      { value: '0', label: 'Contact needed' },
      { value: '-40%', label: 'Wait time' },
      { value: '+20%', label: 'Order value' },
    ],
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'analytics',
    icon: BarChart3,
    title: 'Smart Analytics',
    tagline: 'Data-driven decisions',
    description: 'Real-time dashboards showing revenue trends, peak hours, customer sentiment, and AI-powered business insights you can act on.',
    benefits: [
      'Real-time revenue tracking',
      'Sentiment analysis across reviews',
      'Peak hours and staffing insights',
      'AI-powered recommendations',
    ],
    stats: [
      { value: 'Real-time', label: 'Updates' },
      { value: '50+', label: 'Metrics tracked' },
      { value: 'Weekly', label: 'AI insights' },
    ],
    color: 'from-indigo-500 to-violet-500',
  },
  {
    id: 'integrations',
    icon: Link2,
    title: 'Platform Integrations',
    tagline: 'Connect everything',
    description: 'Sync with Google Business, Square POS, delivery platforms, and social media. One dashboard to manage it all.',
    benefits: [
      'Google Business Profile sync',
      'Square POS integration',
      'DoorDash, Uber Eats, Deliveroo',
      'Social media scheduling',
    ],
    stats: [
      { value: '16+', label: 'Integrations' },
      { value: '1', label: 'Dashboard' },
      { value: '2-way', label: 'Data sync' },
    ],
    color: 'from-rose-500 to-red-500',
  },
]

const advancedFeatures = [
  {
    icon: Mic,
    title: 'Voice AI Assistant',
    description: 'Answer phone calls with AI. Handle reservations, answer questions, and take orders—even when you\'re busy.',
    badge: 'Enterprise',
  },
  {
    icon: Share2,
    title: 'Social Media AI',
    description: 'Generate engaging social posts, respond to comments, and schedule content across platforms.',
    badge: 'Professional',
  },
  {
    icon: Bot,
    title: 'Custom AI Training',
    description: 'Train the AI on your specific menu, policies, and brand voice for perfectly on-brand responses.',
    badge: 'Enterprise',
  },
]

// ============================================================================
// COMPONENTS
// ============================================================================

function FeatureHero({ feature }: { feature: typeof features[0] }) {
  const Icon = feature.icon
  
  return (
    <section id={feature.id} className="py-20 px-4 sm:px-6 lg:px-8 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className={cn(
              'inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br mb-6',
              feature.color
            )}>
              <Icon className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{feature.title}</h2>
            <p className="text-xl text-primary font-medium mb-4">{feature.tagline}</p>
            <p className="text-lg text-muted-foreground mb-6">{feature.description}</p>
            
            <ul className="space-y-3 mb-8">
              {feature.benefits.map((benefit, i) => (
                <li key={i} className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            
            <Link href="/register">
              <Button size="lg">
                Try {feature.title.split(' ')[0]} Free
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {feature.stats.map((stat, i) => (
              <Card key={i} className="text-center">
                <CardContent className="p-6">
                  <p className={cn('text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent', feature.color)}>
                    {stat.value}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function FeatureNav() {
  return (
    <div className="sticky top-16 z-40 bg-background/95 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-1 overflow-x-auto py-2 -mx-4 px-4 scrollbar-hide">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <a
                key={feature.id}
                href={`#${feature.id}`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors whitespace-nowrap"
              >
                <Icon className="h-4 w-4" />
                {feature.title.split(' ').slice(-1)}
              </a>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-xl font-bold text-primary">
              Mitch
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/features" className="text-sm font-medium text-primary">Features</Link>
              <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground">Pricing</Link>
              <Link href="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground">About</Link>
              <Link href="/contact" className="text-sm font-medium text-muted-foreground hover:text-foreground">Contact</Link>
            </div>
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            AI-Powered Restaurant Management
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            Every feature your restaurant needs
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            From AI-powered reviews to contactless ordering, Mitch gives you the tools to 
            save time, delight customers, and grow your business.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg">
                Start Free Trial
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Button size="lg" variant="outline">
              <Play className="h-4 w-4 mr-2" />
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-80" />
            <p className="text-3xl font-bold">15+ hrs</p>
            <p className="text-sm opacity-80">Saved weekly</p>
          </div>
          <div>
            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-80" />
            <p className="text-3xl font-bold">+23%</p>
            <p className="text-sm opacity-80">Revenue increase</p>
          </div>
          <div>
            <Users className="h-8 w-8 mx-auto mb-2 opacity-80" />
            <p className="text-3xl font-bold">500+</p>
            <p className="text-sm opacity-80">Restaurants</p>
          </div>
          <div>
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-80" />
            <p className="text-3xl font-bold">10x</p>
            <p className="text-sm opacity-80">Faster responses</p>
          </div>
        </div>
      </section>

      {/* Feature Navigation */}
      <FeatureNav />

      {/* Feature Sections */}
      {features.map((feature, index) => (
        <div key={feature.id} className={index % 2 === 1 ? 'bg-muted/50' : ''}>
          <FeatureHero feature={feature} />
        </div>
      ))}

      {/* Advanced Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Advanced Features</h2>
            <p className="text-muted-foreground">Take your restaurant to the next level</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {advancedFeatures.map((feature) => {
              const Icon = feature.icon
              return (
                <Card key={feature.title} className="relative overflow-hidden">
                  <CardContent className="p-6">
                    <Badge className="absolute top-4 right-4" variant="secondary">
                      {feature.badge}
                    </Badge>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-lg opacity-90 mb-8">
            Join hundreds of restaurants already using Mitch. Start your free 14-day trial today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" variant="secondary">
                Start Free Trial
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
                View Pricing
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
