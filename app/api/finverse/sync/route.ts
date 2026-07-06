import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { FinverseNotConnectedError } from '@/lib/finverse/access-token'
import { fetchFinverseFinancialData } from '@/lib/finverse/client'

export const runtime = 'nodejs'

/** Pull balances and expense transactions from linked Finverse account. */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const daysParam = req.nextUrl.searchParams.get('days')
  const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 90) : 30

  try {
    const data = await fetchFinverseFinancialData(user.id, days)
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof FinverseNotConnectedError) {
      return NextResponse.json({ error: 'No bank connected' }, { status: 404 })
    }
    console.error('Finverse sync error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch bank data'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
