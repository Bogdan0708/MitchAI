'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

interface NotificationPreferences {
  reviewAlerts: boolean
  orderNotifications: boolean
  weeklyDigest: boolean
  marketingEmails: boolean
}

export default function NotificationsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    reviewAlerts: true,
    orderNotifications: true,
    weeklyDigest: true,
    marketingEmails: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadPreferences = useCallback(async () => {
    try {
      const response = await api.getNotificationPreferences()
      if (response.data) {
        setPreferences(response.data)
      }
    } catch (err) {
      console.error('Failed to load preferences:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  const handleToggle = async (key: keyof NotificationPreferences) => {
    const newValue = !preferences[key]
    const newPreferences = { ...preferences, [key]: newValue }
    setPreferences(newPreferences)

    setIsSaving(true)
    try {
      await api.updateNotificationPreferences({ [key]: newValue })
      setMessage({ type: 'success', text: 'Preferences saved' })
      setTimeout(() => setMessage(null), 2000)
    } catch (err) {
      // Revert on error
      setPreferences(preferences)
      setMessage({ type: 'error', text: 'Failed to save preferences' })
    } finally {
      setIsSaving(false)
    }
  }

  const sendTestEmail = async (type: 'welcome' | 'review' | 'digest') => {
    setSendingTest(type)
    try {
      await api.sendTestEmail(type)
      setMessage({ type: 'success', text: `Test ${type} email sent! Check your console/inbox.` })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to send test email' })
    } finally {
      setSendingTest(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notification Settings</h1>
        <p className="text-muted-foreground">
          Manage how and when you receive notifications
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Email Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>Choose what email notifications you want to receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotificationToggle
            label="Review Alerts"
            description="Get notified when you receive new reviews on Google, Yelp, or other platforms"
            enabled={preferences.reviewAlerts}
            onChange={() => handleToggle('reviewAlerts')}
            disabled={isSaving}
          />

          <div className="border-t pt-4">
            <NotificationToggle
              label="Order Notifications"
              description="Receive alerts for new orders and order status changes"
              enabled={preferences.orderNotifications}
              onChange={() => handleToggle('orderNotifications')}
              disabled={isSaving}
            />
          </div>

          <div className="border-t pt-4">
            <NotificationToggle
              label="Weekly Digest"
              description="Get a summary of your weekly performance including revenue, orders, and reviews"
              enabled={preferences.weeklyDigest}
              onChange={() => handleToggle('weeklyDigest')}
              disabled={isSaving}
            />
          </div>

          <div className="border-t pt-4">
            <NotificationToggle
              label="Marketing & Product Updates"
              description="Receive news about new features, tips, and promotional offers"
              enabled={preferences.marketingEmails}
              onChange={() => handleToggle('marketingEmails')}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Test Emails */}
      <Card>
        <CardHeader>
          <CardTitle>Test Email Notifications</CardTitle>
          <CardDescription>
            Send test emails to preview how notifications look (check your server console in demo mode)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <TestEmailCard
              title="Welcome Email"
              description="The email new users receive after signing up"
              type="welcome"
              isSending={sendingTest === 'welcome'}
              onSend={() => sendTestEmail('welcome')}
            />
            <TestEmailCard
              title="Review Alert"
              description="Sample notification for a new review"
              type="review"
              isSending={sendingTest === 'review'}
              onSend={() => sendTestEmail('review')}
            />
            <TestEmailCard
              title="Weekly Digest"
              description="Sample weekly performance summary"
              type="digest"
              isSending={sendingTest === 'digest'}
              onSend={() => sendTestEmail('digest')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification History Placeholder */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Notification History
            <span className="text-xs font-normal bg-muted px-2 py-1 rounded">Coming Soon</span>
          </CardTitle>
          <CardDescription>View a log of all notifications sent to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <svg className="mx-auto h-12 w-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="mt-2">Notification history will be available in a future update</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function NotificationToggle({
  label,
  description,
  enabled,
  onChange,
  disabled,
}: {
  label: string
  description: string
  enabled: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <div className="font-medium">{label}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${enabled ? 'bg-primary' : 'bg-muted'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${enabled ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  )
}

function TestEmailCard({
  title,
  description,
  type,
  isSending,
  onSend,
}: {
  title: string
  description: string
  type: string
  isSending: boolean
  onSend: () => void
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div>
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onSend}
        disabled={isSending}
        className="w-full"
      >
        {isSending ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2" />
            Sending...
          </>
        ) : (
          <>
            <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send Test
          </>
        )}
      </Button>
    </div>
  )
}
