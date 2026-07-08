import { NextRequest, NextResponse } from 'next/server'
import { buildExpenseSplitContent } from '@/lib/circles/split-expense'
import {
  assertCircleMember,
  getCircleMemberIds,
} from '@/lib/expense/log-from-circle-split'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import { normalizeExpenseCategory } from '@/lib/expense/categories'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'
import { getAuthenticatedUser } from '@/lib/supabase-server'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const circleId = params.id
  if (!circleId) {
    return NextResponse.json({ error: 'Circle id required' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const supabase = createServiceSupabaseClient()

    const isMember = await assertCircleMember(supabase, circleId, user.id)
    if (!isMember) {
      return NextResponse.json({ error: 'Not a member of this circle' }, { status: 403 })
    }

    const description =
      typeof body.description === 'string' ? body.description.trim().slice(0, 120) : ''
    const totalAmount = Number(body.total_amount)
    const category = normalizeExpenseCategory(
      typeof body.category === 'string' ? body.category : 'Social'
    )

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    }

    const memberIds = await getCircleMemberIds(supabase, circleId)
    let participantIds: string[] = Array.isArray(body.participant_ids)
      ? body.participant_ids.filter((id: unknown) => typeof id === 'string')
      : memberIds

    participantIds = Array.from(
      new Set(participantIds.filter(id => memberIds.includes(id)))
    )
    if (!participantIds.includes(user.id)) {
      participantIds.push(user.id)
    }

    if (participantIds.length < 2) {
      return NextResponse.json(
        { error: 'Select at least 2 members to split with' },
        { status: 400 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('primary_currency')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 400 })
    }

    const currency = getProfileDisplayCurrency(profile)
    const content = buildExpenseSplitContent({
      description,
      totalAmount,
      currency,
      participantIds,
      payerId: user.id,
      category,
    })

    const { data: moment, error: insertError } = await supabase
      .from('circle_moments')
      .insert({
        circle_id: circleId,
        sender_id: user.id,
        type: 'expense_split',
        content,
      })
      .select('id, circle_id, sender_id, type, content, reactions, created_at')
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ ok: true, moment })
  } catch (error) {
    console.error('circle split create error:', error)
    return NextResponse.json({ error: 'Failed to create split' }, { status: 500 })
  }
}
