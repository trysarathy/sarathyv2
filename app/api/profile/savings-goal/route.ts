import { NextRequest, NextResponse } from 'next/server'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'
import { getAuthenticatedUser } from '@/lib/supabase-server'

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

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        monthly_savings_goal: goal,
        savings_goal_prompt_dismissed: true,
        goal_name: goal > 0 ? goalName : null,
      })
      .eq('id', user.id)

    if (profileError) throw profileError

    const briefDate = todayInSingapore()
    await supabase
      .from('daily_briefs')
      .delete()
      .eq('user_id', user.id)
      .eq('brief_date', briefDate)

    return NextResponse.json({ ok: true, goal })
  } catch (error) {
    console.error('savings-goal save error:', error)
    return NextResponse.json({ error: 'Failed to save savings goal' }, { status: 500 })
  }
}
