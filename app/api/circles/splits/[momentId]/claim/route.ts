import { NextRequest, NextResponse } from 'next/server'
import { claimCircleSplitShare } from '@/lib/expense/log-from-circle-split'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'
import { getAuthenticatedUser } from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: { momentId: string } }
) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const momentId = params.momentId
  if (!momentId) {
    return NextResponse.json({ error: 'Moment id required' }, { status: 400 })
  }

  try {
    const supabase = createServiceSupabaseClient()

    const { data: moment, error: momentError } = await supabase
      .from('circle_moments')
      .select('id, circle_id, sender_id, type, content')
      .eq('id', momentId)
      .single()

    if (momentError || !moment) {
      return NextResponse.json({ error: 'Split not found' }, { status: 404 })
    }

    const result = await claimCircleSplitShare(supabase, user.id, moment)

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to claim share'
    console.error('circle split claim error:', error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
