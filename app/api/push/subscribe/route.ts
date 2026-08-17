import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : ''
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh : ''
  const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth : ''

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  // 1–2. Save subscription first — never touch profiles if this fails
  const userId = user.id
  const userAgent = req.headers.get('user-agent')?.slice(0, 300) || null

  try {
    // Check if subscription already exists
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .maybeSingle()

    if (existing) {
      // Update existing
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({
          p256dh,
          auth,
          user_agent: userAgent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) throw updateError
    } else {
      // Insert new
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: userId,
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent,
        })

      if (insertError) throw insertError
    }
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : err instanceof Error
          ? err.message
          : 'Could not save subscription'
    console.error('push subscribe error:', message)
    // Do NOT update notifications_prompt_seen or notifications_enabled
    return NextResponse.json(
      {
        error: 'Could not save subscription',
        detail: message,
      },
      { status: 500 }
    )
  }

  // 3. Only after a successful save — enable notifications + mark prompt seen
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      notifications_enabled: true,
      notifications_prompt_seen: true,
    })
    .eq('id', user.id)

  if (profileError) {
    console.error('push subscribe profile update error:', profileError.message)
    // Subscription is saved; still report failure so the client can retry profile flags
    return NextResponse.json(
      {
        error: 'Could not update notification preferences',
        detail: profileError.message,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : null

  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  let query = supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  if (endpoint) query = query.eq('endpoint', endpoint)
  await query

  return NextResponse.json({ ok: true })
}
