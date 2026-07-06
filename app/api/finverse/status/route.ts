import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { getFinverseStatus } from '@/lib/finverse/client'

export const runtime = 'nodejs'

/** Connection summary — no secrets exposed. */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const status = await getFinverseStatus(user.id)
    return NextResponse.json(status)
  } catch (error) {
    console.error('Finverse status error:', error)
    const message = error instanceof Error ? error.message : 'Failed to load connection status'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
