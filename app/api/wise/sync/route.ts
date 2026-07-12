import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { getWiseClient, getWiseMode } from '@/lib/wise'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mode = getWiseMode()

  // Never expose mock/demo balances to the client — unconnected users see empty state.
  if (mode !== 'real') {
    return NextResponse.json({
      mode: 'mock',
      connected: false,
      balances: [],
      transactions: [],
    })
  }

  const daysParam = req.nextUrl.searchParams.get('days')
  const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 30, 1), 90) : 30

  try {
    const client = getWiseClient()
    const [balances, transactions] = await Promise.all([
      client.getBalances(),
      client.getTransactions(days),
    ])

    return NextResponse.json({
      mode: 'real',
      connected: true,
      balances,
      transactions,
    })
  } catch (error) {
    console.error('Wise sync error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch Wise data'
    return NextResponse.json({ error: message, mode: 'real', connected: false }, { status: 503 })
  }
}
