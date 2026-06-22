'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.replace('/home')
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-cream flex flex-col px-6 pt-16 pb-8">
      <div className="mb-10">
        <h1 className="font-fraunces text-3xl font-semibold text-ink mb-2">Welcome back 🌸</h1>
        <p className="text-ink-3 text-sm">Sarathy has been keeping an eye on things.</p>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-4 flex-1">
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
          <label className="text-sm font-medium text-ink-3 mb-2 block">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input-field"
            required
            autoComplete="current-password"
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
            ) : 'Sign in'}
          </button>

          <p className="text-center mt-4 text-sm text-ink-3">
            New here?{' '}
            <Link href="/signup" className="text-saffron font-medium">
              Create your account
            </Link>
          </p>
        </div>
      </form>
    </div>
  )
}
