import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { getWiseClient, getWiseMode } from '@/lib/wise'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      mode: getWiseMode(),
      balances,
      transactions,
    })
  } catch (error) {
    console.error('Wise sync error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch Wise data'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
