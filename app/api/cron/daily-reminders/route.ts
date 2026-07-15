import { NextRequest, NextResponse } from 'next/server'

/**
 * Hourly cron entry — forwards to /api/send-notification with daily mode.
 * Protect with CRON_SECRET (Vercel Cron Authorization header or x-cron-secret).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('Authorization') || ''
  const ok =
    Boolean(cronSecret) &&
    (authHeader === `Bearer ${cronSecret}` ||
      req.headers.get('x-cron-secret') === cronSecret ||
      req.nextUrl.searchParams.get('secret') === cronSecret)

  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const origin = req.nextUrl.origin
  const res = await fetch(`${origin}/api/send-notification`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mode: 'daily' }),
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
