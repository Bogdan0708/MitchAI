'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function TermsPage() {
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
          <h1>Terms of Service</h1>
          <p className="lead">
            Last updated: February 2025
          </p>
          
          <p>
            These Terms of Service ("Terms") govern your use of the Mitch from Transylvania platform 
            ("Service") operated by VBG Solutions Limited ("we", "us", or "our"). By using our Service, 
            you agree to these Terms.
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using our Service, you agree to be bound by these Terms and our Privacy Policy. 
            If you disagree with any part of the Terms, you may not access the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Mitch provides AI-powered tools for restaurants including:
          </p>
          <ul>
            <li>AI-generated review responses</li>
            <li>Menu description enhancement</li>
            <li>Customer chatbot</li>
            <li>QR code ordering</li>
            <li>Analytics and insights</li>
            <li>Platform integrations</li>
          </ul>

          <h2>3. Account Registration</h2>
          <p>
            To use our Service, you must:
          </p>
          <ul>
            <li>Be at least 18 years old</li>
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Promptly notify us of any unauthorized access</li>
          </ul>
          <p>
            You are responsible for all activities that occur under your account.
          </p>

          <h2>4. Subscription and Payment</h2>
          <h3>Billing</h3>
          <ul>
            <li>Subscriptions are billed in advance on a monthly or annual basis</li>
            <li>Prices are in GBP and exclude applicable taxes</li>
            <li>Payment is processed securely via Stripe</li>
          </ul>
          
          <h3>Free Trial</h3>
          <p>
            We offer a 14-day free trial. No credit card is required to start. At the end of your trial, 
            you will need to subscribe to continue using the Service.
          </p>

          <h3>Cancellation</h3>
          <p>
            You may cancel your subscription at any time. Cancellation takes effect at the end of your 
            current billing period. We do not provide refunds for partial months.
          </p>

          <h3>Refund Policy</h3>
          <p>
            We offer a 30-day money-back guarantee on all new subscriptions. Contact us within 30 days 
            of your first payment for a full refund.
          </p>

          <h2>5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any illegal purpose</li>
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe upon the rights of others</li>
            <li>Transmit malicious code or interfere with the Service</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Use the Service to generate spam or misleading content</li>
            <li>Resell or redistribute the Service without authorization</li>
          </ul>

          <h2>6. AI-Generated Content</h2>
          <p>
            Our Service uses artificial intelligence to generate content (review responses, menu descriptions, 
            chat responses, etc.). You acknowledge that:
          </p>
          <ul>
            <li>AI-generated content may require human review before use</li>
            <li>You are responsible for reviewing and approving AI-generated content</li>
            <li>We do not guarantee the accuracy or appropriateness of AI output</li>
            <li>You retain ownership of content you create using our tools</li>
          </ul>

          <h2>7. Data and Privacy</h2>
          <p>
            Your use of the Service is also governed by our <Link href="/privacy">Privacy Policy</Link>. 
            You grant us a license to process your data as necessary to provide the Service.
          </p>

          <h2>8. Intellectual Property</h2>
          <p>
            The Service and its original content, features, and functionality are owned by VBG Solutions 
            Limited and are protected by copyright, trademark, and other intellectual property laws.
          </p>
          <p>
            Content you create using our Service (menu descriptions, responses, etc.) belongs to you.
          </p>

          <h2>9. Third-Party Integrations</h2>
          <p>
            Our Service integrates with third-party platforms (Google Business, Square, etc.). Your use 
            of these integrations is subject to the respective third-party terms of service.
          </p>

          <h2>10. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law:
          </p>
          <ul>
            <li>The Service is provided "as is" without warranties of any kind</li>
            <li>We are not liable for any indirect, incidental, or consequential damages</li>
            <li>Our total liability is limited to the amount you paid us in the past 12 months</li>
          </ul>

          <h2>11. Indemnification</h2>
          <p>
            You agree to indemnify and hold us harmless from any claims, damages, or expenses arising 
            from your use of the Service or violation of these Terms.
          </p>

          <h2>12. Service Modifications</h2>
          <p>
            We reserve the right to modify, suspend, or discontinue the Service at any time. We will 
            provide reasonable notice of significant changes.
          </p>

          <h2>13. Termination</h2>
          <p>
            We may terminate or suspend your account immediately for violations of these Terms. Upon 
            termination, your right to use the Service ceases immediately.
          </p>

          <h2>14. Governing Law</h2>
          <p>
            These Terms are governed by the laws of England and Wales. Any disputes will be resolved 
            in the courts of England and Wales.
          </p>

          <h2>15. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you of material changes via 
            email or through the Service. Continued use after changes constitutes acceptance.
          </p>

          <h2>16. Contact</h2>
          <p>
            For questions about these Terms, contact us at:<br />
            Email: <a href="mailto:vbgsolitionlimited@gmail.com">vbgsolitionlimited@gmail.com</a><br />
            Phone: +44 7471 060258
          </p>
          <p>
            <strong>VBG Solutions Limited</strong><br />
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
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="text-foreground">Terms</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
