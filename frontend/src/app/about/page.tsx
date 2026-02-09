'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, MapPin, Users, Heart, Lightbulb, Target, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

// ============================================================================
// DATA
// ============================================================================

const values = [
  {
    icon: Heart,
    title: 'Hospitality First',
    description: 'We build technology that enhances human connection, not replaces it. Every feature is designed to give restaurant staff more time to focus on what matters: the guest experience.',
  },
  {
    icon: Lightbulb,
    title: 'Practical Innovation',
    description: 'We don\'t chase trends. We solve real problems that restaurant owners face every day. Our AI is powerful, but more importantly, it\'s useful.',
  },
  {
    icon: Target,
    title: 'Results Obsessed',
    description: 'We measure success by your success. Saved hours, increased revenue, happier customers—those are the metrics that matter to us.',
  },
  {
    icon: Users,
    title: 'Built Together',
    description: 'Our best features come from conversations with restaurant owners. We\'re not just vendors; we\'re partners in your success.',
  },
]

const milestones = [
  { year: '2024', title: 'The Idea', description: 'Born from real frustrations managing restaurants in London' },
  { year: '2025', title: 'Mitch Launches', description: 'Platform goes live with AI reviews, chatbot, and menu enhancement' },
  { year: '2025', title: 'Square Integration', description: 'Full POS integration for seamless menu and order sync' },
  { year: '2025', title: 'Growing', description: 'Expanding across the UK hospitality sector' },
]

const stats = [
  { value: '20+', label: 'Years hospitality experience' },
  { value: '6', label: 'AI-powered features' },
  { value: '24/7', label: 'Platform availability' },
  { value: 'London', label: 'Based & built' },
]

const team = [
  {
    name: 'Bogdan Godja',
    role: 'Founder & CEO',
    bio: 'Restaurant Manager at 108 Brasserie, Marylebone Hotel. 10+ years leading hospitality operations across London—from London Business School (1,000+ guests daily) to Fuller\'s (98% online sales growth). Founder of Mitch from Transylvania street food and creator of the Mitch AI platform. MSc from Babeș-Bolyai University. WSET certified. Fluent in English and Romanian.',
    image: null,
    achievements: ['🏆 #1 Fuller\'s Network - App Innovation', '📈 98% Online Sales Growth', '👥 Teams up to 50 people', '🌍 Led EU-funded heritage projects'],
  },
  {
    name: 'Ava Manghi',
    role: 'Co-Founder & Operations',
    bio: 'Luxury hospitality specialist currently at Corinthia Hotel London, previously The Savoy. Expert in cross-functional coordination and VIP guest experiences. Trilingual in English, French, and Italian.',
    image: null,
    achievements: null,
  },
]

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function AboutPage() {
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
              <Link href="/features" className="text-sm font-medium text-muted-foreground hover:text-foreground">Features</Link>
              <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground">Pricing</Link>
              <Link href="/about" className="text-sm font-medium text-primary">About</Link>
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
            Our Story
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            Built by hospitality people,<br />for hospitality people
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Mitch was born from a simple frustration: why should small restaurants miss out on 
            the AI revolution? We're on a mission to make powerful technology accessible to 
            every restaurant, not just the big chains.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-4xl font-bold">{stat.value}</p>
              <p className="text-sm opacity-80">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Origin Story */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="prose prose-lg dark:prose-invert mx-auto">
            <h2>The Problem We Lived</h2>
            <p>
              After a decade managing restaurants across London—from the 108 Brasserie to 
              London Business School events—we knew the pain firsthand. Replying to Google 
              reviews at midnight. Missing customer questions over the weekend. Spending 
              hours on menu descriptions that still didn't quite capture the dish.
            </p>
            <p>
              We watched large chains deploy AI systems while independent restaurants—the 
              heart of our industry—were left behind. The same technology that could save 
              hours every week was locked behind enterprise contracts and tech teams.
            </p>
            <p>
              <strong>That had to change.</strong>
            </p>
            <p>
              The best restaurants aren't always the biggest. They're run by passionate 
              people who put their heart into every plate. Those restaurants deserve 
              the same powerful tools—without the enterprise price tag.
            </p>
            
            <h2>Our Solution</h2>
            <p>
              So we built Mitch: AI tools designed by hospitality people, for hospitality 
              people. Not a watered-down version of enterprise software, but purpose-built 
              features that solve real problems we faced ourselves.
            </p>
            <p>
              The name? <strong>"Mitch from Transylvania"</strong> started as a Romanian 
              street food concept—a nod to our roots. We kept it as a reminder that we're 
              not Silicon Valley. We're restaurant people who happen to build technology.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">What We Believe</h2>
            <p className="text-muted-foreground">The principles that guide everything we build</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {values.map((value) => {
              const Icon = value.icon
              return (
                <Card key={value.title}>
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{value.title}</h3>
                    <p className="text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Our Journey</h2>
            <p className="text-muted-foreground">From idea to industry leader</p>
          </div>
          
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <div key={index} className="relative pl-20">
                  <div className="absolute left-0 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{milestone.year}</span>
                  </div>
                  <h3 className="text-xl font-semibold">{milestone.title}</h3>
                  <p className="text-muted-foreground">{milestone.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team (optional - can be expanded) */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Meet the Team</h2>
            <p className="text-muted-foreground">The people behind Mitch</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {team.map((member) => (
              <Card key={member.name} className="text-center">
                <CardContent className="p-6">
                  <div className="w-24 h-24 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center text-3xl font-bold text-muted-foreground">
                    {member.name[0]}
                  </div>
                  <h3 className="text-lg font-semibold">{member.name}</h3>
                  <p className="text-sm text-primary mb-2">{member.role}</p>
                  <p className="text-sm text-muted-foreground mb-4">{member.bio}</p>
                  {member.achievements && (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {member.achievements.map((achievement, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {achievement}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="text-center mt-8">
            <p className="text-muted-foreground mb-4">We're growing! Interested in joining us?</p>
            <Link href="/contact">
              <Button variant="outline">View Open Positions</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-primary" />
            <span className="font-medium">Based in London, UK</span>
          </div>
          <h2 className="text-3xl font-bold mb-4">Proudly serving restaurants worldwide</h2>
          <p className="text-muted-foreground mb-8">
            While our roots are in London, we serve restaurants across the UK, Europe, and beyond. 
            Our AI works in 12+ languages, and our support team is available in your timezone.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to join the family?</h2>
          <p className="text-lg opacity-90 mb-8">
            Start your free trial today. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" variant="secondary">
                Start Free Trial
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10">
                Get in Touch
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
