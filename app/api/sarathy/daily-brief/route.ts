import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateDailyBrief } from '@/lib/sarathy/daily-brief'
import { getAuthenticatedUser } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await getOrCreateDailyBrief(user.id)

  if (!result) {
    return NextResponse.json({ brief: null, cached: false })
  }

  return NextResponse.json(result)
}
