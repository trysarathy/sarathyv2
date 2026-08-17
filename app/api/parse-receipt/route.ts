import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'
import {
  EXPENSE_CATEGORY_EMOJI,
  getDefaultSubcategory,
  inferSubcategory,
  normalizeExpenseCategory,
  normalizeExpenseSubcategory,
  type ExpenseCategory,
} from '@/lib/expense/categories'
import {
  extractAmountFromText,
  findMerchantMemoryByName,
  findTrustedMerchantMemory,
  upsertMerchantSeen,
} from '@/lib/expense/merchant-memory'
import { matchSingaporePaymentText } from '@/lib/expense/sg-payment-patterns'
import type {
  ParseReceiptApiResponse,
  ParseReceiptConfidence,
  ParseReceiptResult,
} from '@/lib/expense/parse-receipt-types'
import { maybeSendBudgetNudgeAfterExpense } from '@/lib/nudge/send-after-expense'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import { convertCurrencyAmount } from '@/lib/currency/convert'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'

export type { ParseReceiptConfidence, ParseReceiptResult }

const EXTRACT_PROMPT = `Extract payment details from this receipt image.
Return ONLY valid JSON, no other text:
{
  "amount": number or null,
  "currency": "SGD" or "INR" or "USD" etc,
  "merchant": "clean merchant name" or null,
  "merchant_raw": "exactly as shown" or null,
  "date": "YYYY-MM-DD" or null,
  "category": one of exactly: "Food" "Transport" "Shopping" "Home" "Health" "Social" "Education" "Family" "Entertainment" "Other" or null,
  "subcategory": string or null,
  "description": "clean 2-3 word description",
  "confidence": "high" or "low" or "none",
  "is_payment": true or false
}

Currency rules:
S$, SGD, $SG → "SGD"
₹, Rs, INR → "INR"
No symbol + Singapore context → "SGD"

Category rules:
GrabFood, Foodpanda, hawker, kopitiam, 
restaurant, cafe, kopi → Food
MRT, bus, Grab ride, taxi, petrol → Transport
Shopee, Lazada, shopping, clothing → Shopping
PayNow to a person → Social (suggest split)
Wise transfer to India → Family
DBS, OCBC, UOB alerts → check merchant for category

Confidence rules:
high = amount clearly visible + merchant identified 
       + this is clearly a payment
low = amount found but category uncertain
none = no payment found / not a receipt

Return JSON only. No markdown. No explanation.`

function pickAltCategory(primary: ExpenseCategory): ExpenseCategory {
  const alts: ExpenseCategory[] = ['Food', 'Transport', 'Shopping', 'Social', 'Other']
  return alts.find((c) => c !== primary) || 'Other'
}

function normalizeConfidence(value: unknown): ParseReceiptConfidence {
  if (value === 'high' || value === 'low' || value === 'none') return value
  return 'none'
}

function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const raw = value.trim().toUpperCase()
  if (raw === 'S$' || raw === '$SG' || raw === 'SINGAPORE DOLLAR') return 'SGD'
  if (raw === 'RS' || raw === 'RS.' || raw === '₹') return 'INR'
  return raw.replace(/[^A-Z]/g, '').slice(0, 3) || null
}

function normalizeParsed(raw: Record<string, unknown>): ParseReceiptResult {
  const amount =
    typeof raw.amount === 'number' && Number.isFinite(raw.amount) && raw.amount > 0
      ? raw.amount
      : null

  const category = normalizeExpenseCategory(
    typeof raw.category === 'string' ? raw.category : 'Other'
  )
  const merchant =
    typeof raw.merchant === 'string' && raw.merchant.trim() ? raw.merchant.trim() : null
  const merchant_raw =
    typeof raw.merchant_raw === 'string' && raw.merchant_raw.trim()
      ? raw.merchant_raw.trim()
      : merchant
  const description =
    typeof raw.description === 'string' && raw.description.trim()
      ? raw.description.trim()
      : merchant || ''

  const subcategory = normalizeExpenseSubcategory(
    category,
    typeof raw.subcategory === 'string' && raw.subcategory.trim()
      ? raw.subcategory
      : inferSubcategory(category, `${description} ${merchant || ''}`)
  )

  let confidence = normalizeConfidence(raw.confidence)
  let is_payment = raw.is_payment === true

  if (amount == null) {
    confidence = 'none'
    is_payment = false
  } else if (raw.is_payment === false && confidence === 'none') {
    is_payment = false
  } else if (amount != null && confidence !== 'none') {
    is_payment = true
  }

  const category_alt =
    confidence === 'low' ? pickAltCategory(category) : null

  return {
    is_payment,
    confidence,
    amount,
    currency: normalizeCurrency(raw.currency),
    merchant,
    merchant_raw,
    date:
      typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw.date)
        ? raw.date.slice(0, 10)
        : null,
    category,
    category_alt,
    subcategory,
    description: description || subcategory || category,
    emoji: EXPENSE_CATEGORY_EMOJI[category],
  }
}

async function callGroq(params: {
  imageBase64?: string
  text?: string
}): Promise<ParseReceiptResult> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('Missing GROQ_API_KEY')

  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = []

  if (params.imageBase64) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${params.imageBase64}` },
    })
    content.push({ type: 'text', text: EXTRACT_PROMPT })
  } else {
    content.push({
      type: 'text',
      text: `${EXTRACT_PROMPT}\n\nPayment message: ${(params.text || '').slice(0, 4000)}`,
    })
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.imageBase64
        ? 'meta-llama/llama-4-scout-17b-16e-instruct'
        : 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content }],
      max_tokens: 300,
      temperature: 0,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Groq error ${response.status}: ${detail.slice(0, 200)}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = data.choices?.[0]?.message?.content?.trim() || '{}'
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  const parsed = JSON.parse(jsonMatch?.[0] ?? cleaned) as Record<string, unknown>
  return normalizeParsed(parsed)
}

async function saveShareEntry(params: {
  userId: string
  amount: number
  category: string
  subcategory?: string | null
  description: string
  entryDate?: string | null
  originalAmount?: number | null
  originalCurrency?: string | null
  primaryCurrency: string
}) {
  const supabase = createServiceSupabaseClient()
  const category = normalizeExpenseCategory(params.category)
  const subcategory =
    params.subcategory?.trim() ||
    getDefaultSubcategory(category)
  const entry_date =
    params.entryDate && /^\d{4}-\d{2}-\d{2}/.test(params.entryDate)
      ? params.entryDate.slice(0, 10)
      : todayInSingapore()

  const row: Record<string, unknown> = {
    user_id: params.userId,
    category,
    subcategory,
    amount: params.amount,
    description: params.description || subcategory || category,
    entry_date,
    logged_via: 'share',
  }

  if (
    params.originalCurrency &&
    params.originalAmount != null &&
    params.originalCurrency !== params.primaryCurrency
  ) {
    row.original_amount = params.originalAmount
    row.original_currency = params.originalCurrency
  }

  let { data, error } = await supabase
    .from('budget_entries')
    .insert(row)
    .select('id, amount, category, subcategory, description, entry_date, logged_via')
    .single()

  if (error && /subcategory|original_amount|original_currency/i.test(error.message)) {
    if (/subcategory/i.test(error.message)) delete row.subcategory
    if (/original_amount|original_currency/i.test(error.message)) {
      delete row.original_amount
      delete row.original_currency
    }
    ;({ data, error } = await supabase
      .from('budget_entries')
      .insert(row)
      .select('id, amount, category, subcategory, description, entry_date, logged_via')
      .single())
  }

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save expense')
  }

  await maybeSendBudgetNudgeAfterExpense(params.userId, entry_date)

  return data
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const imageRaw =
      typeof body?.image === 'string'
        ? body.image
        : typeof body?.imageBase64 === 'string'
          ? body.imageBase64
          : ''
    const imageBase64 = imageRaw.replace(/^data:image\/\w+;base64,/, '').trim()
    const text =
      typeof body?.text === 'string'
        ? body.text.trim()
        : [body?.title, body?.url].filter((v) => typeof v === 'string').join('\n').trim()

    if (!imageBase64 && !text) {
      const res: ParseReceiptApiResponse = { success: false, confidence: 'none' }
      return NextResponse.json(res)
    }

    const supabase = createServiceSupabaseClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('primary_currency')
      .eq('id', user.id)
      .single()
    const primaryCurrency = getProfileDisplayCurrency({
      primary_currency: profile?.primary_currency || 'SGD',
    })

    // 1) Trusted merchant memory — skip Groq when text contains a known merchant
    if (text && !imageBase64) {
      const memory = await findTrustedMerchantMemory(supabase, user.id, text)
      const amountFromText = extractAmountFromText(text)
      if (memory && amountFromText != null) {
        const category = normalizeExpenseCategory(memory.category)
        const subcategory =
          memory.subcategory || getDefaultSubcategory(category)
        const description = memory.merchant

        const entry = await saveShareEntry({
          userId: user.id,
          amount: amountFromText,
          category,
          subcategory,
          description,
          primaryCurrency,
        })

        await upsertMerchantSeen(supabase, {
          userId: user.id,
          merchant: memory.merchant,
          category,
          subcategory,
        })

        const res: ParseReceiptApiResponse = {
          success: true,
          confidence: 'high',
          from_memory: true,
          entry: {
            id: entry.id,
            amount: Number(entry.amount),
            category: entry.category,
            subcategory: entry.subcategory,
            description: entry.description || description,
            entry_date: entry.entry_date,
            logged_via: entry.logged_via || 'share',
            merchant: memory.merchant,
            emoji: EXPENSE_CATEGORY_EMOJI[category],
          },
          message: `Logged with your usual category for ${memory.merchant}`,
        }
        return NextResponse.json(res)
      }
    }

    // 1b) Singapore bank / Grab / PayNow / Wise / Shopee SMS patterns (no Groq)
    if (text && !imageBase64) {
      const patternHit = matchSingaporePaymentText(text)
      if (patternHit) {
        let category = patternHit.category
        let subcategory = patternHit.subcategory
        let description = patternHit.description
        const merchant = patternHit.merchant

        if (merchant) {
          const memory = await findMerchantMemoryByName(supabase, user.id, merchant)
          if (memory && memory.times_corrected === 0) {
            category = normalizeExpenseCategory(memory.category)
            subcategory =
              memory.subcategory ||
              inferSubcategory(category, description)
            patternHit.emoji = EXPENSE_CATEGORY_EMOJI[category]
          }
        }

        let amountPrimary = patternHit.amount!
        const originalCurrency = patternHit.original_currency || patternHit.currency
        const originalAmount =
          patternHit.original_amount != null
            ? patternHit.original_amount
            : patternHit.amount

        // Wise: amount is already SGD; keep INR as original_*
        // Other patterns: amount is SGD — only convert if currency ≠ primary
        if (
          !patternHit.original_currency &&
          patternHit.currency &&
          patternHit.currency !== primaryCurrency
        ) {
          amountPrimary = await convertCurrencyAmount(
            patternHit.amount!,
            patternHit.currency,
            primaryCurrency
          )
        }

        const entry = await saveShareEntry({
          userId: user.id,
          amount: amountPrimary,
          category,
          subcategory,
          description,
          entryDate: patternHit.date,
          originalAmount:
            originalCurrency && originalCurrency !== primaryCurrency
              ? originalAmount
              : patternHit.original_amount ?? null,
          originalCurrency:
            originalCurrency && originalCurrency !== primaryCurrency
              ? originalCurrency
              : patternHit.original_currency ?? null,
          primaryCurrency,
        })

        if (merchant) {
          await upsertMerchantSeen(supabase, {
            userId: user.id,
            merchant,
            category,
            subcategory,
          })
        }

        const res: ParseReceiptApiResponse = {
          success: true,
          confidence: 'high',
          entry: {
            id: entry.id,
            amount: Number(entry.amount),
            category: entry.category,
            subcategory: entry.subcategory,
            description: entry.description || description,
            entry_date: entry.entry_date,
            logged_via: entry.logged_via || 'share',
            merchant,
            emoji: EXPENSE_CATEGORY_EMOJI[normalizeExpenseCategory(category)],
          },
          message: patternHit.suggest_split
            ? 'Logged — looks like a transfer to a person'
            : undefined,
        }
        return NextResponse.json(res)
      }
    }

    // 2) Call Groq (images, or text that didn't match a known pattern)
    const parsed = await callGroq({
      imageBase64: imageBase64 || undefined,
      text: text || undefined,
    })

    // Apply trusted merchant memory category override after Groq
    if (parsed.merchant) {
      const memory = await findMerchantMemoryByName(supabase, user.id, parsed.merchant)
      if (memory && memory.times_corrected === 0) {
        parsed.category = normalizeExpenseCategory(memory.category)
        parsed.subcategory =
          memory.subcategory ||
          inferSubcategory(parsed.category, parsed.description)
        parsed.emoji = EXPENSE_CATEGORY_EMOJI[parsed.category]
        parsed.category_alt = null
        if (parsed.amount != null && parsed.is_payment) {
          parsed.confidence = 'high'
        }
      }
    }

    if (parsed.confidence === 'none' || !parsed.is_payment || parsed.amount == null) {
      const res: ParseReceiptApiResponse = {
        success: false,
        confidence: 'none',
        amount: parsed.amount,
        merchant: parsed.merchant,
        description: parsed.description,
      }
      return NextResponse.json(res)
    }

    // Convert foreign currency into primary when needed
    let amountPrimary = parsed.amount
    const originalCurrency = parsed.currency
    if (originalCurrency && originalCurrency !== primaryCurrency) {
      amountPrimary = await convertCurrencyAmount(
        parsed.amount,
        originalCurrency,
        primaryCurrency
      )
    }

    if (parsed.confidence === 'low') {
      const optionA = parsed.category
      const optionB = parsed.category_alt || pickAltCategory(optionA)
      const res: ParseReceiptApiResponse = {
        success: false,
        confidence: 'low',
        amount: amountPrimary,
        currency: originalCurrency || primaryCurrency,
        merchant: parsed.merchant,
        description: parsed.description,
        subcategory: parsed.subcategory,
        date: parsed.date,
        options: [optionA, optionB],
      }
      return NextResponse.json(res)
    }

    // high confidence → save + memory + nudge
    const entry = await saveShareEntry({
      userId: user.id,
      amount: amountPrimary,
      category: parsed.category,
      subcategory: parsed.subcategory,
      description: parsed.description,
      entryDate: parsed.date,
      originalAmount: parsed.amount,
      originalCurrency,
      primaryCurrency,
    })

    if (parsed.merchant) {
      await upsertMerchantSeen(supabase, {
        userId: user.id,
        merchant: parsed.merchant,
        category: parsed.category,
        subcategory: parsed.subcategory,
      })
    }

    const res: ParseReceiptApiResponse = {
      success: true,
      confidence: 'high',
      entry: {
        id: entry.id,
        amount: Number(entry.amount),
        category: entry.category,
        subcategory: entry.subcategory,
        description: entry.description || parsed.description,
        entry_date: entry.entry_date,
        logged_via: entry.logged_via || 'share',
        merchant: parsed.merchant,
        emoji:
          EXPENSE_CATEGORY_EMOJI[normalizeExpenseCategory(entry.category)] ||
          parsed.emoji,
      },
    }
    return NextResponse.json(res)
  } catch (error) {
    console.error('parse-receipt error:', error)
    const res: ParseReceiptApiResponse = { success: false, confidence: 'none' }
    return NextResponse.json(res)
  }
}
