import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'

/**
 * POST { email } → { exists: boolean | null }
 * Used by /login after a failed sign-in to pick the right error copy.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const email =
    typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !email.includes('@')) {
    return NextResponse.json({ exists: false })
  }

  try {
    const admin = createServiceSupabaseClient()
    const { data, error } = await admin.rpc('auth_email_exists', {
      lookup_email: email,
    })

    if (error) {
      console.error('auth_email_exists:', error.message)
      return NextResponse.json({ exists: null })
    }

    return NextResponse.json({ exists: Boolean(data) })
  } catch (err) {
    console.error('email-exists failed:', err)
    return NextResponse.json({ exists: null })
  }
}
