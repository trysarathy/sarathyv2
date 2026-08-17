import {
  EXPENSE_CATEGORY_EMOJI,
  type ExpenseCategory,
} from '@/lib/expense/categories'
import type { ParseReceiptResult } from '@/lib/expense/parse-receipt-types'
import { todayInSingapore } from '@/lib/sarathy/sgt'

export type SgPatternMatch = ParseReceiptResult & {
  /** True when a known Singapore SMS/alert pattern matched with high confidence. */
  matched: true
  pattern: string
  /** For Wise dual-currency etc. — amount already in SGD unless noted. */
  original_amount?: number | null
  original_currency?: string | null
  suggest_split?: boolean
}

function parseMoney(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Best-effort date → YYYY-MM-DD (SGT). */
function parseFlexibleDate(raw: string | undefined | null): string | null {
  if (!raw?.trim()) return null
  const s = raw.trim()

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)

  // 14/08/2026 or 14-08-26
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (dmy) {
    const day = dmy[1].padStart(2, '0')
    const month = dmy[2].padStart(2, '0')
    let year = dmy[3]
    if (year.length === 2) year = `20${year}`
    return `${year}-${month}-${day}`
  }

  // 14 Aug 2026 / 14 Aug
  const mon = s.match(
    /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?(?:\s+(\d{2,4}))?/i
  )
  if (mon) {
    const months: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    }
    const day = mon[1].padStart(2, '0')
    const month = months[mon[2].slice(0, 3).toLowerCase()]
    const today = todayInSingapore()
    let year = mon[3]
    if (!year) year = today.slice(0, 4)
    else if (year.length === 2) year = `20${year}`
    if (!month) return null
    return `${year}-${month}-${day}`
  }

  return null
}

function cleanMerchant(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/, '')
    .trim()
}

function refineUnknownMerchant(
  merchant: string
): { category: ExpenseCategory; subcategory: string | null } | null {
  const d = merchant.toLowerCase()
  if (
    /koufu|hawker|mcdonald|starbucks|coffee|kopi|fairprice|ntuc|cold\s*storage|restaurant|cafe|food|pizza|burger|ramen|sushi|grabfood|foodpanda/.test(
      d
    )
  ) {
    if (/fairprice|ntuc|cold\s*storage|grocer/.test(d)) {
      return { category: 'Food', subcategory: 'Groceries' }
    }
    if (/starbucks|coffee|kopi|cafe/.test(d)) {
      return { category: 'Food', subcategory: 'Coffee' }
    }
    return { category: 'Food', subcategory: 'Hawker' }
  }
  if (/grab|gojek|mrt|bus|taxi|shell|esso|caltex|petrol/.test(d)) {
    return { category: 'Transport', subcategory: /grab|gojek/.test(d) ? 'Grab' : 'MRT/Bus' }
  }
  if (/shopee|lazada|uniqlo|h&m|amazon/.test(d)) {
    return { category: 'Shopping', subcategory: 'Online Shopping' }
  }
  return null
}

function isFamilyRecipient(name: string): boolean {
  const n = name.toLowerCase()
  return (
    /\b(mum|mom|mother|dad|daddy|father|papa|amma|apppa|appaji|家人|家)\b/i.test(name) ||
    n.includes('家') ||
    n.includes('amma') ||
    n.includes('apppa')
  )
}

function hit(
  partial: Omit<SgPatternMatch, 'matched' | 'is_payment' | 'confidence' | 'emoji' | 'category_alt'> & {
    category: ExpenseCategory
  }
): SgPatternMatch {
  return {
    matched: true,
    is_payment: true,
    confidence: 'high',
    category_alt: null,
    emoji: EXPENSE_CATEGORY_EMOJI[partial.category],
    currency: partial.currency ?? 'SGD',
    merchant_raw: partial.merchant_raw ?? partial.merchant,
    date: partial.date ?? null,
    subcategory: partial.subcategory ?? null,
    description: partial.description,
    amount: partial.amount,
    category: partial.category,
    merchant: partial.merchant,
    pattern: partial.pattern,
    original_amount: partial.original_amount ?? null,
    original_currency: partial.original_currency ?? null,
    suggest_split: partial.suggest_split,
  }
}

/**
 * Fast path for common Singapore bank / Grab / PayNow / Wise / Shopee SMS text.
 * Returns null when no confident pattern match (caller should use Groq).
 */
export function matchSingaporePaymentText(text: string): SgPatternMatch | null {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return null

  // ── DBS card / debit ──────────────────────────────────────────────
  // DBS: S$X.XX was deducted from your account ending XXXX at MERCHANT on DATE
  {
    const m = t.match(
      /DBS[:\s].*?S\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s+was\s+deducted.*?at\s+(.+?)\s+on\s+([0-9]{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,}(?:\s+\d{2,4})?)/i
    )
    if (m) {
      const amount = parseMoney(m[1])
      const merchant = cleanMerchant(m[2])
      if (amount && merchant) {
        const refined = refineUnknownMerchant(merchant)
        return hit({
          pattern: 'dbs_deducted',
          amount,
          merchant,
          date: parseFlexibleDate(m[3]),
          category: refined?.category ?? 'Other',
          subcategory: refined?.subcategory ?? null,
          description: merchant,
          currency: 'SGD',
        })
      }
    }
  }

  // DBS PayNow: You sent S$X.XX to NAME
  {
    const m = t.match(
      /DBS\s*PayNow[:\s].*?sent\s+S\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s+to\s+(.+?)(?:\.|$)/i
    )
    if (m) {
      const amount = parseMoney(m[1])
      const name = cleanMerchant(m[2])
      if (amount && name) {
        const family = isFamilyRecipient(name)
        return hit({
          pattern: 'dbs_paynow',
          amount,
          merchant: name,
          category: family ? 'Family' : 'Social',
          subcategory: family ? 'Send Home' : 'Friends',
          description: family ? `PayNow to ${name}` : `PayNow · ${name}`,
          currency: 'SGD',
          suggest_split: !family,
        })
      }
    }
  }

  // ── OCBC ──────────────────────────────────────────────────────────
  // Your account ending XXXX has been debited S$X.XX at MERCHANT
  {
    const m = t.match(
      /(?:OCBC|account\s+ending\s+\d+)\s.*?debited\s+S\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s+at\s+(.+?)(?:\.|$)/i
    )
    if (m) {
      const amount = parseMoney(m[1])
      const merchant = cleanMerchant(m[2])
      if (amount && merchant) {
        const refined = refineUnknownMerchant(merchant)
        return hit({
          pattern: 'ocbc_debited',
          amount,
          merchant,
          category: refined?.category ?? 'Other',
          subcategory: refined?.subcategory ?? null,
          description: merchant,
          currency: 'SGD',
        })
      }
    }
  }

  // ── UOB ───────────────────────────────────────────────────────────
  // UOB CREDIT: S$X.XX spent at MERCHANT
  {
    const m = t.match(
      /UOB\s*(?:CREDIT)?[:\s].*?S\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s+spent\s+at\s+(.+?)(?:\.|$)/i
    )
    if (m) {
      const amount = parseMoney(m[1])
      const merchant = cleanMerchant(m[2])
      if (amount && merchant) {
        const refined = refineUnknownMerchant(merchant)
        return hit({
          pattern: 'uob_credit',
          amount,
          merchant,
          category: refined?.category ?? 'Other',
          subcategory: refined?.subcategory ?? null,
          description: merchant,
          currency: 'SGD',
        })
      }
    }
  }

  // ── Grab ride ─────────────────────────────────────────────────────
  // Your Grab ride on DATE cost S$X.XX
  {
    const m = t.match(
      /Grab\s+ride\s+on\s+(.+?)\s+cost\s+S\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i
    )
    if (m) {
      const amount = parseMoney(m[2])
      if (amount) {
        return hit({
          pattern: 'grab_ride',
          amount,
          merchant: 'Grab',
          date: parseFlexibleDate(m[1]),
          category: 'Transport',
          subcategory: 'Grab',
          description: 'Grab ride',
          currency: 'SGD',
        })
      }
    }
  }

  // GrabFood order from RESTAURANT. Total: S$X.XX
  {
    const m = t.match(
      /GrabFood\s+order\s+from\s+(.+?)(?:\.|,|\n)\s*(?:Total|Amt|Amount)?\s*:?\s*S\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i
    )
    if (m) {
      const amount = parseMoney(m[2])
      const restaurant = cleanMerchant(m[1])
      if (amount && restaurant) {
        return hit({
          pattern: 'grabfood',
          amount,
          merchant: restaurant,
          category: 'Food',
          subcategory: 'Delivery',
          description: restaurant,
          currency: 'SGD',
        })
      }
    }
  }

  // ── PayNow generic ────────────────────────────────────────────────
  // PayNow transfer of S$X.XX to NAME successful
  {
    const m = t.match(
      /PayNow\s+transfer\s+of\s+S\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s+to\s+(.+?)\s+successful/i
    )
    if (m) {
      const amount = parseMoney(m[1])
      const name = cleanMerchant(m[2])
      if (amount && name) {
        const family = isFamilyRecipient(name)
        return hit({
          pattern: 'paynow_transfer',
          amount,
          merchant: name,
          category: family ? 'Family' : 'Social',
          subcategory: family ? 'Send Home' : 'Friends',
          description: family ? `PayNow to ${name}` : `PayNow · ${name}`,
          currency: 'SGD',
          suggest_split: !family,
        })
      }
    }
  }

  // ── Wise ──────────────────────────────────────────────────────────
  // You sent S$X.XX (₹X,XXX) to your account in India
  {
    const m = t.match(
      /(?:Wise|TransferWise).*?sent\s+S\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*\(\s*(?:₹|Rs\.?|INR)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*\).*?(?:India|INR)/i
    ) || t.match(
      /You\s+sent\s+S\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*\(\s*(?:₹|Rs\.?|INR)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*\).*?(?:account\s+in\s+India|India)/i
    )
    if (m) {
      const sgd = parseMoney(m[1])
      const inr = parseMoney(m[2])
      if (sgd) {
        return hit({
          pattern: 'wise_india',
          amount: sgd,
          merchant: 'Wise',
          category: 'Family',
          subcategory: 'Send Home',
          description: 'Send home',
          currency: 'SGD',
          original_amount: inr,
          original_currency: inr != null ? 'INR' : null,
        })
      }
    }
  }

  // ── Shopee ────────────────────────────────────────────────────────
  // Payment of S$X.XX for your Shopee order
  {
    const m = t.match(
      /Payment\s+of\s+S\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s+for\s+your\s+Shopee\s+order/i
    )
    if (m) {
      const amount = parseMoney(m[1])
      if (amount) {
        return hit({
          pattern: 'shopee',
          amount,
          merchant: 'Shopee',
          category: 'Shopping',
          subcategory: 'Online Shopping',
          description: 'Shopee order',
          currency: 'SGD',
        })
      }
    }
  }

  return null
}
