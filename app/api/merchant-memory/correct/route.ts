import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'
import { normalizeExpenseCategory } from '@/lib/expense/categories'
import { correctMerchantMemory } from '@/lib/expense/merchant-memory'

/**
 * POST /api/merchant-memory/correct
 * Remember a corrected category for a merchant after low-confidence share flow.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const merchant = typeof body?.merchant === 'string' ? body.merchant.trim() : ''
    const category = normalizeExpenseCategory(
      typeof body?.category === 'string' ? body.category : 'Other'
    )
    const subcategory =
      typeof body?.subcategory === 'string' && body.subcategory.trim()
        ? body.subcategory.trim()
        : null

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant required' }, { status: 400 })
    }

    const supabase = createServiceSupabaseClient()
    const result = await correctMerchantMemory(supabase, {
      userId: user.id,
      merchant,
      category,
      subcategory,
    })

    if (!result) {
      return NextResponse.json({ error: 'Could not save correction' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      merchant: result.merchant,
      category: result.category,
      message: `Got it — I'll remember ${result.merchant} as ${result.category} from now on 🙌`,
    })
  } catch (error) {
    console.error('merchant-memory correct error:', error)
    return NextResponse.json({ error: 'Correction failed' }, { status: 500 })
  }
}
