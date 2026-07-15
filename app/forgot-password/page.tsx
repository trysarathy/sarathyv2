'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AuthShell from '@/components/auth/AuthShell'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (resetError) throw resetError
      setSent(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <form onSubmit={handleReset} className="auth-form">
        <div className="auth-form-header">
          <h2 className="auth-form-title">Forgot password?</h2>
          <p className="auth-form-sub">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div
            style={{
              background: '#F0FDF4',
              color: '#166534',
              fontSize: '0.9rem',
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              lineHeight: 1.45,
            }}
          >
            Check your inbox for a password reset link. It may take a minute to arrive.
          </div>
        ) : (
          <>
            <div className="auth-field">
              <label htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your university or personal email"
                className="auth-input"
                required
                autoComplete="email"
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-cta" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : 'Send reset link →'}
            </button>
          </>
        )}

        <Link href="/login" className="auth-alt-link">
          <span>← Back to login</span>
        </Link>
      </form>
    </AuthShell>
  )
}
