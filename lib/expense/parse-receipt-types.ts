import {
  EXPENSE_CATEGORY_EMOJI,
  type ExpenseCategory,
} from '@/lib/expense/categories'

export type ParseReceiptConfidence = 'high' | 'low' | 'none'

/** Legacy flat shape (still useful for UI helpers). */
export type ParseReceiptResult = {
  is_payment: boolean
  confidence: ParseReceiptConfidence
  amount: number | null
  currency?: string | null
  merchant?: string | null
  merchant_raw?: string | null
  date?: string | null
  category: ExpenseCategory
  category_alt: ExpenseCategory | null
  subcategory: string | null
  description: string
  emoji: string
}

export type ParseReceiptEntry = {
  id: string
  amount: number
  category: string
  subcategory: string | null
  description: string
  entry_date: string
  logged_via: string
  merchant?: string | null
  emoji?: string
}

export type ParseReceiptApiResponse =
  | {
      success: true
      confidence: 'high'
      entry: ParseReceiptEntry
      from_memory?: boolean
      message?: string
    }
  | {
      success: false
      confidence: 'low'
      amount: number
      currency?: string | null
      merchant?: string | null
      description?: string
      subcategory?: string | null
      options: [ExpenseCategory, ExpenseCategory]
      date?: string | null
    }
  | {
      success: false
      confidence: 'none'
      amount?: number | null
      merchant?: string | null
      description?: string
    }

export function emptyParseReceiptResult(
  partial?: Partial<ParseReceiptResult>
): ParseReceiptResult {
  return {
    is_payment: false,
    confidence: 'none',
    amount: null,
    currency: null,
    merchant: null,
    merchant_raw: null,
    date: null,
    category: 'Other',
    category_alt: null,
    subcategory: null,
    description: '',
    emoji: EXPENSE_CATEGORY_EMOJI.Other,
    ...partial,
  }
}
