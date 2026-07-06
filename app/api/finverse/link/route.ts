import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { generateFinverseLinkUrl } from '@/lib/finverse/link'
import { FinverseApiError, getFinverseErrorMessage } from '@/lib/finverse/errors'

export const runtime = 'nodejs'

/** Start Finverse Link — returns hosted URL for bank consent. */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { url } = await generateFinverseLinkUrl(user.id)
    return NextResponse.json({ url })
  } catch (error) {
    const message = getFinverseErrorMessage(error)
    const status = error instanceof FinverseApiError && error.status ? error.status : 503
    console.error('Finverse link route error:', message)
    return NextResponse.json({ error: message }, { status: status >= 500 ? 503 : status })
  }
}
