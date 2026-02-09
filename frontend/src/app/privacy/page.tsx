'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        <div className="prose prose-gray dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2>1. Introduction</h2>
            <p>
              Mitch from Transylvania Ltd ("Mitch", "we", "us", or "our") is committed to protecting 
              your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard 
              your information when you use our hospitality management platform and related services 
              (the "Service").
            </p>
            <p>
              By using our Service, you agree to the collection and use of information in accordance 
              with this policy. If you do not agree with the terms of this Privacy Policy, please do 
              not access the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2>2. Information We Collect</h2>
            
            <h3>2.1 Information You Provide</h3>
            <ul>
              <li><strong>Account Information:</strong> Name, email address, password, business name, and contact details when you register</li>
              <li><strong>Business Data:</strong> Menu items, pricing, orders, customer information, and reviews you input into the platform</li>
              <li><strong>Payment Information:</strong> Billing address and payment method details (processed securely via Stripe)</li>
              <li><strong>Communications:</strong> Messages you send to us for support or feedback</li>
            </ul>

            <h3>2.2 Information Collected Automatically</h3>
            <ul>
              <li><strong>Usage Data:</strong> Pages visited, features used, time spent on the platform</li>
              <li><strong>Device Information:</strong> Browser type, operating system, IP address</li>
              <li><strong>Cookies:</strong> Session cookies for authentication and preference cookies for user experience</li>
            </ul>

            <h3>2.3 Information from Third Parties</h3>
            <ul>
              <li><strong>POS Integrations:</strong> Menu and order data from Square, Toast, or other connected systems</li>
              <li><strong>Review Platforms:</strong> Reviews from Google, TripAdvisor, and other platforms you connect</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2>3. How We Use Your Information</h2>
            <p>We use the collected information for:</p>
            <ul>
              <li>Providing and maintaining the Service</li>
              <li>Processing transactions and sending related information</li>
              <li>Generating AI-powered responses, menu descriptions, and analytics</li>
              <li>Sending administrative messages, updates, and marketing communications (with consent)</li>
              <li>Improving our Service through analytics and user feedback</li>
              <li>Detecting, preventing, and addressing technical issues or fraud</li>
              <li>Complying with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2>4. AI Processing</h2>
            <p>
              Our Service uses artificial intelligence to provide features such as:
            </p>
            <ul>
              <li>Automated review responses</li>
              <li>Menu description generation</li>
              <li>Sentiment analysis of customer feedback</li>
              <li>AI-powered chatbot for customer enquiries</li>
            </ul>
            <p>
              Your business data may be processed by AI models provided by OpenAI, Anthropic, or other 
              providers. We do not use your data to train these models. All AI processing is done to 
              provide you with the Service features you've requested.
            </p>
          </section>

          <section className="mb-8">
            <h2>5. Data Sharing and Disclosure</h2>
            <p>We may share your information with:</p>
            <ul>
              <li><strong>Service Providers:</strong> Third parties that perform services on our behalf (hosting, payment processing, email delivery)</li>
              <li><strong>AI Providers:</strong> OpenAI, Anthropic, and similar providers for AI feature functionality</li>
              <li><strong>Integration Partners:</strong> Square, Stripe, and other platforms you choose to connect</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or governmental authority</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
            <p>
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2>6. Data Security</h2>
            <p>
              We implement appropriate technical and organisational measures to protect your data, including:
            </p>
            <ul>
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Regular security assessments and penetration testing</li>
              <li>Access controls and authentication requirements</li>
              <li>Automated backups and disaster recovery procedures</li>
              <li>Two-factor authentication option for user accounts</li>
            </ul>
            <p>
              While we strive to protect your information, no method of transmission over the Internet 
              is 100% secure. We cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2>7. Data Retention</h2>
            <p>
              We retain your information for as long as your account is active or as needed to provide 
              the Service. Upon account termination:
            </p>
            <ul>
              <li>Account data is deleted within 30 days</li>
              <li>Backup data is purged within 90 days</li>
              <li>Anonymised analytics data may be retained indefinitely</li>
              <li>Data required for legal compliance may be retained as required by law</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2>8. Your Rights (UK GDPR)</h2>
            <p>Under UK data protection law, you have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Request correction of inaccurate data</li>
              <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
              <li><strong>Restriction:</strong> Request limitation of processing</li>
              <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
              <li><strong>Object:</strong> Object to processing based on legitimate interests</li>
              <li><strong>Withdraw Consent:</strong> Withdraw consent at any time where processing is based on consent</li>
            </ul>
            <p>
              To exercise these rights, contact us at <a href="mailto:privacy@mitchfromtransylvania.com">privacy@mitchfromtransylvania.com</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2>9. Cookies</h2>
            <p>We use the following types of cookies:</p>
            <ul>
              <li><strong>Essential Cookies:</strong> Required for the Service to function (authentication, security)</li>
              <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how you use the Service</li>
            </ul>
            <p>
              You can control cookies through your browser settings. Disabling essential cookies may 
              affect Service functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2>10. International Data Transfers</h2>
            <p>
              Your data may be transferred to and processed in countries outside the UK, including the 
              United States (where our cloud infrastructure and AI providers are located). We ensure 
              appropriate safeguards are in place, including Standard Contractual Clauses approved by 
              the UK ICO.
            </p>
          </section>

          <section className="mb-8">
            <h2>11. Children's Privacy</h2>
            <p>
              Our Service is not intended for individuals under 18 years of age. We do not knowingly 
              collect personal information from children. If you believe we have collected information 
              from a child, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2>12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material 
              changes by posting the new policy on this page and updating the "Last updated" date. 
              Your continued use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2>13. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <ul>
              <li><strong>Email:</strong> <a href="mailto:privacy@mitchfromtransylvania.com">privacy@mitchfromtransylvania.com</a></li>
              <li><strong>Address:</strong> Mitch from Transylvania Ltd, London, United Kingdom</li>
              <li><strong>ICO Registration:</strong> [Registration Number - to be added]</li>
            </ul>
            <p>
              You also have the right to lodge a complaint with the Information Commissioner's Office (ICO) 
              at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">ico.org.uk</a>.
            </p>
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
            <Link href="/privacy" className="text-foreground font-medium">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
