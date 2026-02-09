'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function PrivacyPage() {
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

      {/* Content */}
      <article className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto prose prose-gray dark:prose-invert">
          <h1>Privacy Policy</h1>
          <p className="lead">
            Last updated: February 2025
          </p>
          
          <p>
            VBG Solutions Limited ("Mitch", "we", "us", or "our") operates the Mitch from Transylvania 
            platform (the "Service"). This page informs you of our policies regarding the collection, 
            use, and disclosure of personal data when you use our Service.
          </p>

          <h2>1. Information We Collect</h2>
          
          <h3>Account Information</h3>
          <p>When you create an account, we collect:</p>
          <ul>
            <li>Name and email address</li>
            <li>Business name and contact details</li>
            <li>Billing information (processed securely via Stripe)</li>
          </ul>

          <h3>Usage Data</h3>
          <p>We automatically collect:</p>
          <ul>
            <li>Log data (IP address, browser type, pages visited)</li>
            <li>Device information</li>
            <li>Analytics data to improve our Service</li>
          </ul>

          <h3>Business Data</h3>
          <p>To provide our Service, we process:</p>
          <ul>
            <li>Menu items and descriptions</li>
            <li>Customer reviews from connected platforms</li>
            <li>Order and reservation data</li>
            <li>Chat conversations with your customers</li>
          </ul>

          <h2>2. How We Use Your Data</h2>
          <p>We use your data to:</p>
          <ul>
            <li>Provide and maintain our Service</li>
            <li>Process your transactions</li>
            <li>Send service-related communications</li>
            <li>Improve our AI models and features</li>
            <li>Provide customer support</li>
            <li>Detect and prevent fraud</li>
          </ul>

          <h2>3. AI and Your Data</h2>
          <p>
            Our AI features process your business data to generate responses, descriptions, and insights. 
            We do not use your data to train AI models for other customers. Your business data remains 
            isolated to your account.
          </p>

          <h2>4. Data Sharing</h2>
          <p>We may share your data with:</p>
          <ul>
            <li><strong>Service providers:</strong> AWS (hosting), Stripe (payments), Sentry (error tracking)</li>
            <li><strong>AI providers:</strong> OpenAI, Anthropic (for AI features, subject to their privacy policies)</li>
            <li><strong>Integrated platforms:</strong> Only data you explicitly choose to sync (e.g., Google Business)</li>
          </ul>
          <p>We never sell your personal data to third parties.</p>

          <h2>5. Data Security</h2>
          <p>We implement industry-standard security measures:</p>
          <ul>
            <li>256-bit AES encryption for data at rest</li>
            <li>TLS 1.3 encryption for data in transit</li>
            <li>Regular security audits</li>
            <li>SOC 2 compliant infrastructure</li>
          </ul>

          <h2>6. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. You can request deletion of your 
            data at any time. We may retain certain data as required by law or for legitimate business purposes.
          </p>

          <h2>7. Your Rights (GDPR)</h2>
          <p>Under GDPR, you have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your data</li>
            <li><strong>Rectification:</strong> Correct inaccurate data</li>
            <li><strong>Erasure:</strong> Request deletion of your data</li>
            <li><strong>Portability:</strong> Export your data in a standard format</li>
            <li><strong>Objection:</strong> Object to certain processing activities</li>
          </ul>
          <p>
            To exercise these rights, contact us at <a href="mailto:vbgsolitionlimited@gmail.com">vbgsolitionlimited@gmail.com</a>.
          </p>

          <h2>8. Cookies</h2>
          <p>
            We use essential cookies to operate our Service and analytics cookies (with your consent) 
            to understand usage patterns. You can manage cookie preferences in your browser settings.
          </p>

          <h2>9. Children's Privacy</h2>
          <p>
            Our Service is not intended for individuals under 18. We do not knowingly collect data 
            from children.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. We will notify you of significant changes 
            via email or through the Service.
          </p>

          <h2>11. Contact Us</h2>
          <p>
            For privacy-related questions, contact us at:<br />
            Email: <a href="mailto:vbgsolitionlimited@gmail.com">vbgsolitionlimited@gmail.com</a><br />
            Phone: +44 7471 060258
          </p>
          <p>
            <strong>Data Controller:</strong><br />
            VBG Solutions Limited<br />
            United Kingdom
          </p>
        </div>
      </article>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 Mitch from Transylvania. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
