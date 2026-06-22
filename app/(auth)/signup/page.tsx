'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      router.replace('/onboarding')
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-cream flex flex-col px-6 pt-16 pb-8">
      <div className="mb-10">
        <h1 className="font-fraunces text-3xl font-semibold text-ink mb-2">Let's get started 🌟</h1>
        <p className="text-ink-3 text-sm">Sarathy will be ready in about 60 seconds.</p>
      </div>

      <form onSubmit={handleSignup} className="flex flex-col gap-4 flex-1">
        <div>
          <label className="text-sm font-medium text-ink-3 mb-2 block">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="input-field"
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-ink-3 mb-2 block">Choose a password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="at least 8 characters"
            className="input-field"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-danger text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="mt-auto pt-4">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : "Create my account →"}
          </button>

          <p className="text-center mt-4 text-sm text-ink-3">
            Already have an account?{' '}
            <Link href="/login" className="text-saffron font-medium">Sign in</Link>
          </p>
        </div>
      </form>
    </div>
  )
}
