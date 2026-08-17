import type { SupabaseClient } from '@supabase/supabase-js'
import {
  normalizeExpenseCategory,
  type ExpenseCategory,
} from '@/lib/expense/categories'

export type MerchantMemoryRow = {
  id: string
  user_id: string
  merchant: string
  merchant_normalized: string
  category: string
  subcategory: string | null
  times_seen: number
  times_corrected: number
}

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function findTrustedMerchantMemory(
  supabase: SupabaseClient,
  userId: string,
  haystack: string
): Promise<MerchantMemoryRow | null> {
  const text = haystack.trim()
  if (!text) return null

  const { data, error } = await supabase
    .from('merchant_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('times_corrected', 0)
    .order('times_seen', { ascending: false })
    .limit(50)

  if (error || !data?.length) return null

  const hay = normalizeMerchantName(text)
  let best: MerchantMemoryRow | null = null
  let bestLen = 0

  for (const row of data as MerchantMemoryRow[]) {
    const key = row.merchant_normalized || normalizeMerchantName(row.merchant)
    if (!key || key.length < 3) continue
    if (hay.includes(key) || key.includes(hay)) {
      if (key.length > bestLen) {
        best = row
        bestLen = key.length
      }
    }
  }

  return best
}

export async function findMerchantMemoryByName(
  supabase: SupabaseClient,
  userId: string,
  merchant: string
): Promise<MerchantMemoryRow | null> {
  const key = normalizeMerchantName(merchant)
  if (!key) return null

  const { data } = await supabase
    .from('merchant_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('merchant_normalized', key)
    .maybeSingle()

  return (data as MerchantMemoryRow | null) ?? null
}

/** Upsert memory and increment times_seen. */
export async function upsertMerchantSeen(
  supabase: SupabaseClient,
  params: {
    userId: string
    merchant: string
    category: string
    subcategory?: string | null
  }
): Promise<void> {
  const merchant = params.merchant.trim()
  if (!merchant) return
  const merchant_normalized = normalizeMerchantName(merchant)
  if (!merchant_normalized) return

  const category = normalizeExpenseCategory(params.category)
  const existing = await findMerchantMemoryByName(supabase, params.userId, merchant)

  if (existing) {
    await supabase
      .from('merchant_memory')
      .update({
        times_seen: (existing.times_seen || 0) + 1,
        // Only refresh category if never corrected
        ...(existing.times_corrected === 0
          ? {
              category,
              subcategory: params.subcategory ?? existing.subcategory,
              merchant,
            }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    return
  }

  await supabase.from('merchant_memory').insert({
    user_id: params.userId,
    merchant,
    merchant_normalized,
    category,
    subcategory: params.subcategory ?? null,
    times_seen: 1,
    times_corrected: 0,
    updated_at: new Date().toISOString(),
  })
}

export async function correctMerchantMemory(
  supabase: SupabaseClient,
  params: {
    userId: string
    merchant: string
    category: ExpenseCategory | string
    subcategory?: string | null
  }
): Promise<{ merchant: string; category: ExpenseCategory } | null> {
  const merchant = params.merchant.trim()
  if (!merchant) return null
  const category = normalizeExpenseCategory(params.category)
  const merchant_normalized = normalizeMerchantName(merchant)
  const existing = await findMerchantMemoryByName(supabase, params.userId, merchant)

  if (existing) {
    await supabase
      .from('merchant_memory')
      .update({
        merchant,
        category,
        subcategory: params.subcategory ?? existing.subcategory,
        times_corrected: (existing.times_corrected || 0) + 1,
        times_seen: (existing.times_seen || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('merchant_memory').insert({
      user_id: params.userId,
      merchant,
      merchant_normalized,
      category,
      subcategory: params.subcategory ?? null,
      times_seen: 1,
      times_corrected: 1,
      updated_at: new Date().toISOString(),
    })
  }

  return { merchant, category }
}

/** Best-effort amount from shared payment text (e.g. "S$8.50", "₹200"). */
export function extractAmountFromText(text: string): number | null {
  const patterns = [
    /(?:S\$|SGD|₹|Rs\.?|INR|USD|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /\b([0-9]{1,4}(?:\.[0-9]{2}))\b/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (!m?.[1]) continue
    const n = parseFloat(m[1].replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0 && n < 100000) return n
  }
  return null
}
