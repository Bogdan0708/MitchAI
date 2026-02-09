'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function TermsPage() {
  const lastUpdated = '9 February 2026'
  
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-xl font-bold text-primary">
              Mitch
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        <div className="prose prose-gray dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2>1. Agreement to Terms</h2>
            <p>
              These Terms of Service ("Terms") constitute a legally binding agreement between you 
              ("you" or "Customer") and Mitch from Transylvania Ltd ("Mitch", "we", "us", or "our") 
              governing your access to and use of the Mitch platform, including any related websites, 
              applications, and services (collectively, the "Service").
            </p>
            <p>
              By accessing or using the Service, you agree to be bound by these Terms. If you do not 
              agree to these Terms, you may not access or use the Service. If you are using the Service 
              on behalf of an organisation, you represent that you have authority to bind that 
              organisation to these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2>2. Description of Service</h2>
            <p>
              Mitch provides a hospitality management platform that includes:
            </p>
            <ul>
              <li>AI-powered review response generation</li>
              <li>Menu management and description enhancement</li>
              <li>Customer chatbot and enquiry handling</li>
              <li>Order management and POS integration</li>
              <li>Analytics and reporting</li>
              <li>QR code generation for digital menus</li>
            </ul>
            <p>
              Features available to you depend on your subscription tier. We reserve the right to 
              modify, suspend, or discontinue any part of the Service at any time.
            </p>
          </section>

          <section className="mb-8">
            <h2>3. Account Registration</h2>
            <h3>3.1 Account Creation</h3>
            <p>
              To use the Service, you must create an account by providing accurate, complete, and 
              current information. You are responsible for maintaining the confidentiality of your 
              account credentials and for all activities under your account.
            </p>
            
            <h3>3.2 Account Requirements</h3>
            <ul>
              <li>You must be at least 18 years old</li>
              <li>You must provide a valid email address</li>
              <li>You must not create multiple accounts for the same business</li>
              <li>You must notify us immediately of any unauthorised access</li>
            </ul>

            <h3>3.3 Account Security</h3>
            <p>
              We recommend enabling two-factor authentication (2FA) for enhanced security. You are 
              responsible for any actions taken through your account, whether or not authorised by you.
            </p>
          </section>

          <section className="mb-8">
            <h2>4. Subscription and Payment</h2>
            <h3>4.1 Subscription Tiers</h3>
            <p>
              We offer various subscription tiers (Starter, Professional, Enterprise) with different 
              features and pricing. Current pricing is available at{' '}
              <Link href="/pricing" className="text-primary hover:underline">mitchfromtransylvania.com/pricing</Link>.
            </p>

            <h3>4.2 Billing</h3>
            <ul>
              <li>Subscriptions are billed monthly or annually in advance</li>
              <li>Payment is processed securely via Stripe</li>
              <li>Prices are in GBP and exclude VAT where applicable</li>
              <li>Failed payments may result in service suspension</li>
            </ul>

            <h3>4.3 Free Trial</h3>
            <p>
              We may offer a free trial period. At the end of the trial, you will be automatically 
              charged unless you cancel. You may cancel at any time during the trial without charge.
            </p>

            <h3>4.4 Refunds</h3>
            <p>
              Subscription fees are non-refundable except as required by law. If you cancel mid-cycle, 
              you will retain access until the end of your current billing period.
            </p>

            <h3>4.5 Price Changes</h3>
            <p>
              We may change our prices with 30 days' notice. Continued use of the Service after a 
              price change constitutes acceptance of the new price.
            </p>
          </section>

          <section className="mb-8">
            <h2>5. Acceptable Use</h2>
            <h3>5.1 You Agree To:</h3>
            <ul>
              <li>Use the Service only for lawful purposes</li>
              <li>Provide accurate information about your business</li>
              <li>Comply with all applicable laws and regulations</li>
              <li>Respect the intellectual property rights of others</li>
              <li>Maintain the security of your account</li>
            </ul>

            <h3>5.2 You Agree Not To:</h3>
            <ul>
              <li>Use the Service for any illegal or fraudulent purpose</li>
              <li>Attempt to gain unauthorised access to the Service or other accounts</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Reverse engineer, decompile, or disassemble the Service</li>
              <li>Use automated tools to scrape or extract data</li>
              <li>Resell, sublicense, or redistribute the Service without permission</li>
              <li>Upload malicious code, viruses, or harmful content</li>
              <li>Impersonate any person or entity</li>
              <li>Use AI features to generate illegal, harmful, or deceptive content</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2>6. Your Content and Data</h2>
            <h3>6.1 Ownership</h3>
            <p>
              You retain ownership of all content and data you upload to the Service ("Your Content"). 
              This includes menu items, business information, customer data, and any other materials 
              you provide.
            </p>

            <h3>6.2 License to Mitch</h3>
            <p>
              By uploading Your Content, you grant us a worldwide, non-exclusive, royalty-free license 
              to use, store, process, and display Your Content solely for the purpose of providing 
              the Service to you. This license terminates when you delete Your Content or your account.
            </p>

            <h3>6.3 Your Responsibilities</h3>
            <p>
              You are responsible for:
            </p>
            <ul>
              <li>Ensuring you have the right to upload Your Content</li>
              <li>Backing up Your Content (we provide backups but recommend maintaining your own)</li>
              <li>Complying with data protection laws regarding customer data you process</li>
              <li>The accuracy of menu information, prices, and allergen declarations</li>
            </ul>

            <h3>6.4 Data Protection</h3>
            <p>
              When you use the Service to process personal data of your customers, you act as the 
              data controller and we act as the data processor. Our{' '}
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>{' '}
              describes how we handle data.
            </p>
          </section>

          <section className="mb-8">
            <h2>7. AI-Generated Content</h2>
            <h3>7.1 Nature of AI Content</h3>
            <p>
              Our Service uses artificial intelligence to generate content such as review responses, 
              menu descriptions, and chatbot replies. AI-generated content is created based on your 
              inputs and may not always be accurate or appropriate.
            </p>

            <h3>7.2 Your Responsibility</h3>
            <p>
              You are responsible for reviewing and approving all AI-generated content before use. 
              We recommend editing AI outputs to match your brand voice and ensure accuracy. You 
              should not rely solely on AI for critical communications.
            </p>

            <h3>7.3 No Guarantees</h3>
            <p>
              We do not guarantee that AI-generated content will be error-free, appropriate for your 
              specific situation, or achieve any particular result. AI features are provided "as is".
            </p>
          </section>

          <section className="mb-8">
            <h2>8. Intellectual Property</h2>
            <h3>8.1 Our Property</h3>
            <p>
              The Service, including its design, features, code, documentation, and branding, is 
              owned by Mitch and protected by intellectual property laws. Nothing in these Terms 
              grants you ownership of the Service.
            </p>

            <h3>8.2 Limited License</h3>
            <p>
              Subject to these Terms, we grant you a limited, non-exclusive, non-transferable license 
              to access and use the Service for your internal business purposes during your subscription.
            </p>

            <h3>8.3 Feedback</h3>
            <p>
              If you provide feedback, suggestions, or ideas about the Service, you grant us the 
              right to use them without restriction or compensation.
            </p>
          </section>

          <section className="mb-8">
            <h2>9. Third-Party Integrations</h2>
            <p>
              The Service may integrate with third-party platforms (Square, Stripe, Google, etc.). 
              Your use of these integrations is subject to the respective third party's terms and 
              privacy policies. We are not responsible for the availability, security, or practices 
              of third-party services.
            </p>
          </section>

          <section className="mb-8">
            <h2>10. Service Availability</h2>
            <h3>10.1 Uptime</h3>
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted access. 
              The Service may be temporarily unavailable due to maintenance, updates, or circumstances 
              beyond our control.
            </p>

            <h3>10.2 Support</h3>
            <p>
              Support is provided based on your subscription tier. Enterprise customers receive 
              priority support with dedicated response times.
            </p>
          </section>

          <section className="mb-8">
            <h2>11. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law:
            </p>
            <ul>
              <li>
                <strong>No Consequential Damages:</strong> We shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages, including loss of profits, 
                revenue, data, or business opportunities.
              </li>
              <li>
                <strong>Liability Cap:</strong> Our total liability for any claims arising from 
                these Terms or the Service shall not exceed the amount you paid us in the 12 months 
                preceding the claim.
              </li>
              <li>
                <strong>No Warranty:</strong> The Service is provided "as is" without warranties 
                of any kind, express or implied, including merchantability, fitness for a particular 
                purpose, or non-infringement.
              </li>
            </ul>
            <p>
              These limitations apply regardless of the theory of liability and even if we have been 
              advised of the possibility of such damages.
            </p>
          </section>

          <section className="mb-8">
            <h2>12. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Mitch and its officers, directors, 
              employees, and agents from any claims, damages, losses, or expenses (including 
              reasonable legal fees) arising from:
            </p>
            <ul>
              <li>Your use of the Service</li>
              <li>Your Content or data</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any third-party rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2>13. Termination</h2>
            <h3>13.1 By You</h3>
            <p>
              You may cancel your subscription at any time through your account settings or by 
              contacting us. Cancellation takes effect at the end of your current billing period.
            </p>

            <h3>13.2 By Us</h3>
            <p>
              We may suspend or terminate your account if you:
            </p>
            <ul>
              <li>Violate these Terms</li>
              <li>Fail to pay fees when due</li>
              <li>Engage in fraudulent or illegal activity</li>
              <li>Abuse or threaten our staff</li>
            </ul>

            <h3>13.3 Effect of Termination</h3>
            <p>
              Upon termination:
            </p>
            <ul>
              <li>Your access to the Service will cease</li>
              <li>You may export your data within 30 days (contact support)</li>
              <li>Your data will be deleted in accordance with our Privacy Policy</li>
              <li>Provisions that should survive termination will remain in effect</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2>14. Dispute Resolution</h2>
            <h3>14.1 Informal Resolution</h3>
            <p>
              Before initiating formal proceedings, you agree to contact us to attempt informal 
              resolution. Most disputes can be resolved through direct communication.
            </p>

            <h3>14.2 Governing Law</h3>
            <p>
              These Terms are governed by the laws of England and Wales. Any disputes shall be 
              subject to the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>

          <section className="mb-8">
            <h2>15. Changes to Terms</h2>
            <p>
              We may modify these Terms at any time. We will notify you of material changes via 
              email or through the Service. Continued use after changes constitutes acceptance. 
              If you disagree with changes, you may terminate your account.
            </p>
          </section>

          <section className="mb-8">
            <h2>16. General Provisions</h2>
            <ul>
              <li>
                <strong>Entire Agreement:</strong> These Terms, together with our Privacy Policy, 
                constitute the entire agreement between you and Mitch.
              </li>
              <li>
                <strong>Severability:</strong> If any provision is found unenforceable, the 
                remaining provisions remain in effect.
              </li>
              <li>
                <strong>Waiver:</strong> Our failure to enforce any right does not waive that right.
              </li>
              <li>
                <strong>Assignment:</strong> You may not assign these Terms without our consent. 
                We may assign these Terms in connection with a merger or acquisition.
              </li>
              <li>
                <strong>Force Majeure:</strong> We are not liable for delays or failures due to 
                circumstances beyond our reasonable control.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2>17. Contact Us</h2>
            <p>
              For questions about these Terms, please contact us:
            </p>
            <ul>
              <li><strong>Email:</strong> <a href="mailto:legal@mitchfromtransylvania.com">legal@mitchfromtransylvania.com</a></li>
              <li><strong>Address:</strong> Mitch from Transylvania Ltd, London, United Kingdom</li>
            </ul>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 Mitch from Transylvania. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="text-foreground font-medium">Terms</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
