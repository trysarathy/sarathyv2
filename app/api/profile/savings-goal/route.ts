import { NextRequest, NextResponse } from 'next/server'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'
import { getAuthenticatedUser } from '@/lib/supabase-server'

function parseTargetAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

function parseTargetDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const trimmed = raw.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  return trimmed
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const supabase = createServiceSupabaseClient()

    if (body.dismiss === true) {
      const { error } = await supabase
        .from('profiles')
        .update({ savings_goal_prompt_dismissed: true })
        .eq('id', user.id)

      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    const goal = Math.max(0, Math.round(Number(body.goal) || 0))
    const goalName =
      typeof body.goalName === 'string' && body.goalName.trim()
        ? body.goalName.trim().slice(0, 80)
        : null
    const goalTargetAmount = goal > 0 ? parseTargetAmount(body.goalTargetAmount) : null
    const goalTargetDate = goal > 0 ? parseTargetDate(body.goalTargetDate) : null

    const { data: existing } = await supabase
      .from('profiles')
      .select('goal_started_at')
      .eq('id', user.id)
      .single()

    const today = todayInSingapore()
    const updatePayload: Record<string, unknown> = {
      monthly_savings_goal: goal,
      savings_goal_prompt_dismissed: true,
      goal_name: goal > 0 ? goalName : null,
      goal_target_amount: goal > 0 ? goalTargetAmount : null,
      goal_target_date: goal > 0 ? goalTargetDate : null,
    }

    if (goal === 0) {
      updatePayload.goal_saved_amount = 0
      updatePayload.goal_progress_through_month = null
      updatePayload.goal_started_at = null
    } else if (!existing?.goal_started_at) {
      updatePayload.goal_started_at = `${today.slice(0, 7)}-01`
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id)

    if (profileError) throw profileError

    await supabase
      .from('daily_briefs')
      .delete()
      .eq('user_id', user.id)
      .eq('brief_date', today)

    return NextResponse.json({ ok: true, goal })
  } catch (error) {
    console.error('savings-goal save error:', error)
    return NextResponse.json({ error: 'Failed to save savings goal' }, { status: 500 })
  }
}
