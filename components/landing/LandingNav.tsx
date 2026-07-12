'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LandingNav() {
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSignedIn(Boolean(session))
    })
  }, [])

  return (
    <nav className="landing-nav" aria-label="Primary">
      <Link href="/" className="landing-nav-brand">
        Sarathy
      </Link>
      <div className="landing-nav-actions">
        {signedIn ? (
          <Link href="/home" className="landing-nav-cta">
            Open app →
          </Link>
        ) : (
          <>
            <Link href="/login" className="landing-nav-link">
              Sign in
            </Link>
            <Link href="/signup" className="landing-nav-cta">
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
