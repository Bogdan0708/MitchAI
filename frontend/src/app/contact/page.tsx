'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Phone, MapPin, MessageSquare, Clock, Send, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ============================================================================
// DATA
// ============================================================================

const contactMethods = [
  {
    icon: Mail,
    title: 'Email Us',
    description: 'For general inquiries and support',
    contact: 'hello@mitchfromtransylvania.com',
    action: 'mailto:hello@mitchfromtransylvania.com',
  },
  {
    icon: MessageSquare,
    title: 'Live Chat',
    description: 'Chat with our team in real-time',
    contact: 'Available 9am-6pm GMT',
    action: '#chat', // Could open chat widget
  },
  {
    icon: Phone,
    title: 'Call Us',
    description: 'Speak with our sales team',
    contact: '+44 20 XXXX XXXX', // Placeholder
    action: 'tel:+442000000000',
  },
]

const offices = [
  {
    city: 'London',
    address: 'Commercial Street, Spitalfields',
    country: 'United Kingdom',
    type: 'Headquarters',
  },
]

const inquiryTypes = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'sales', label: 'Sales & Pricing' },
  { value: 'support', label: 'Technical Support' },
  { value: 'partnership', label: 'Partnership Opportunity' },
  { value: 'press', label: 'Press & Media' },
]

// ============================================================================
// COMPONENTS
// ============================================================================

function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    restaurant: '',
    inquiryType: 'general',
    message: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Simulate form submission - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setIsSubmitting(false)
    setIsSubmitted(true)
  }

  if (isSubmitted) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Message Sent!</h3>
        <p className="text-muted-foreground mb-6">
          Thanks for reaching out. We'll get back to you within 24 hours.
        </p>
        <Button variant="outline" onClick={() => setIsSubmitted(false)}>
          Send Another Message
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Your Name *</Label>
          <Input
            id="name"
            required
            placeholder="John Smith"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email Address *</Label>
          <Input
            id="email"
            type="email"
            required
            placeholder="john@restaurant.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="restaurant">Restaurant Name</Label>
          <Input
            id="restaurant"
            placeholder="The Best Restaurant"
            value={formData.restaurant}
            onChange={(e) => setFormData({ ...formData, restaurant: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inquiryType">Inquiry Type</Label>
          <select
            id="inquiryType"
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            value={formData.inquiryType}
            onChange={(e) => setFormData({ ...formData, inquiryType: e.target.value })}
          >
            {inquiryTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message *</Label>
        <textarea
          id="message"
          required
          rows={5}
          placeholder="Tell us how we can help..."
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
        />
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="h-4 w-4 mr-2" />
            Send Message
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        By submitting this form, you agree to our{' '}
        <Link href="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </form>
  )
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ContactPage() {
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
              <Link href="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground">About</Link>
              <Link href="/contact" className="text-sm font-medium text-primary">Contact</Link>
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
            We're Here to Help
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold mb-6">
            Get in touch
          </h1>
          <p className="text-xl text-muted-foreground">
            Have a question? Want a demo? Just want to say hi? We'd love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact Methods */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
          {contactMethods.map((method) => {
            const Icon = method.icon
            return (
              <a
                key={method.title}
                href={method.action}
                className="block"
              >
                <Card className="h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-1">{method.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{method.description}</p>
                    <p className="text-sm font-medium text-primary">{method.contact}</p>
                  </CardContent>
                </Card>
              </a>
            )
          })}
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-5 gap-12">
          {/* Form */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Send us a message</CardTitle>
                <CardDescription>
                  Fill out the form below and we'll get back to you within 24 hours.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContactForm />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 space-y-6">
            {/* Response Time */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Quick Response</h3>
                    <p className="text-sm text-muted-foreground">
                      We typically respond to all inquiries within 24 hours during business days.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Office */}
            {offices.map((office) => (
              <Card key={office.city}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <Badge variant="secondary" className="mb-2">{office.type}</Badge>
                      <h3 className="font-semibold">{office.city}</h3>
                      <p className="text-sm text-muted-foreground">
                        {office.address}<br />
                        {office.country}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Support Hours */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Support Hours</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monday - Friday</span>
                    <span>9:00 AM - 6:00 PM GMT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saturday</span>
                    <span>10:00 AM - 4:00 PM GMT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sunday</span>
                    <span>Closed</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Enterprise customers have access to 24/7 support.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Link */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Looking for quick answers?</h2>
          <p className="text-muted-foreground mb-6">
            Check out our pricing page for frequently asked questions, or browse our help center.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/pricing#faq">
              <Button variant="outline">View FAQ</Button>
            </Link>
            <Link href="/features">
              <Button variant="outline">Explore Features</Button>
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
