import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { maybeSendBudgetNudgeAfterExpense } from '@/lib/nudge/send-after-expense'
import { todayInSingapore } from '@/lib/sarathy/sgt'

/**
 * POST /api/nudge/after-expense
 * After an expense is saved for today — send at most one budget warning push per day.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const entryDate =
    typeof body?.entryDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(body.entryDate)
      ? body.entryDate.slice(0, 10)
      : todayInSingapore()

  const result = await maybeSendBudgetNudgeAfterExpense(user.id, entryDate)
  return NextResponse.json(result)
}
