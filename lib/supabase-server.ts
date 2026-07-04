import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

/** Validate Bearer token from Authorization header; returns user or null. */
export async function getAuthenticatedUser(req: NextRequest): Promise<User | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.slice(7).trim()
  if (!token) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}
