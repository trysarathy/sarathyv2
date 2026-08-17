'use client'

import { Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/api-auth'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import {
  EXPENSE_CATEGORY_EMOJI,
  getDefaultSubcategory,
  normalizeExpenseCategory,
  type ExpenseCategory,
} from '@/lib/expense/categories'
import { currencySymbol } from '@/lib/currency/convert'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import type {
  ParseReceiptApiResponse,
  ParseReceiptResult,
} from '@/lib/expense/parse-receipt-types'
import UndoToast from '@/components/UndoToast'

const PURPLE = '#1C0F3F'
const GOLD = '#D4A853'
const SHARE_CACHE = 'sarathy-share-v1'
const SHARE_FILE_KEY = '/__share_file'

type Phase =
  | 'processing'
  | 'success'
  | 'low'
  | 'manual'
  | 'removed'
  | 'redirecting'

type LoggedEntry = {
  id: string
  amount: number
  category: ExpenseCategory
  subcategory: string
  description: string
  emoji: string
}

function exitShare() {
  try {
    if (window.history.length > 1) {
      window.history.back()
      return
    }
  } catch {
    /* ignore */
  }
  window.location.href = '/home'
}

async function fileToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(blob)
  })
  return dataUrl.replace(/^data:image\/\w+;base64,/, '')
}

async function readSharedFile(): Promise<Blob | null> {
  try {
    const cache = await caches.open(SHARE_CACHE)
    const res = await cache.match(SHARE_FILE_KEY)
    if (!res) return null
    const blob = await res.blob()
    await cache.delete(SHARE_FILE_KEY)
    return blob.size > 0 ? blob : null
  } catch {
    return null
  }
}

function formatMoney(amount: number, currency: string): string {
  const n = Number.isFinite(amount) ? amount : 0
  const symbol = currencySymbol(currency)
  return `${symbol}${n.toFixed(2)}`
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100dvh',
            background: PURPLE,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 56,
                fontWeight: 600,
                color: GOLD,
                animation: 'shareLogoPulse 1.4s ease-in-out infinite',
              }}
            >
              S✦
            </div>
            <p style={{ marginTop: 20, fontSize: 15 }}>Reading your receipt...</p>
          </div>
        </div>
      }
    >
      <SharePageInner />
    </Suspense>
  )
}

function SharePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [phase, setPhase] = useState<Phase>('processing')
  const [currency, setCurrency] = useState('SGD')
  const [parsed, setParsed] = useState<Partial<ParseReceiptResult> | null>(null)
  const [lowOptions, setLowOptions] = useState<[ExpenseCategory, ExpenseCategory] | null>(
    null
  )
  const [rememberNote, setRememberNote] = useState('')
  const [logged, setLogged] = useState<LoggedEntry | null>(null)
  const [manualAmount, setManualAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const startedRef = useRef(false)
  const manualInputRef = useRef<HTMLInputElement>(null)

  const saveExpense = useCallback(
    async (opts: {
      amount: number
      category: string
      subcategory?: string | null
      description?: string
    }): Promise<LoggedEntry | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent('/share')}`)
        return null
      }

      const category = normalizeExpenseCategory(opts.category)
      const subcategory =
        opts.subcategory?.trim() || getDefaultSubcategory(category)
      const description =
        opts.description?.trim() || subcategory || category
      const entryDate = todayInSingapore()

      const row: Record<string, unknown> = {
        user_id: user.id,
        category,
        subcategory,
        amount: opts.amount,
        description,
        entry_date: entryDate,
        logged_via: 'share',
      }

      let { data, error } = await supabase
        .from('budget_entries')
        .insert(row)
        .select('id, amount, category, subcategory, description')
        .single()

      if (error && /subcategory/i.test(error.message)) {
        delete row.subcategory
        ;({ data, error } = await supabase
          .from('budget_entries')
          .insert(row)
          .select('id, amount, category, subcategory, description')
          .single())
      }

      if (error || !data) {
        console.error('share save failed:', error?.message)
        return null
      }

      try {
        await fetch('/api/nudge/after-expense', {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ entryDate }),
        })
      } catch {
        /* non-blocking */
      }

      return {
        id: data.id,
        amount: Number(data.amount),
        category: normalizeExpenseCategory(data.category),
        subcategory: data.subcategory || subcategory,
        description: data.description || description,
        emoji: EXPENSE_CATEGORY_EMOJI[normalizeExpenseCategory(data.category)],
      }
    },
    [router, supabase]
  )

  const showSuccess = useCallback((entry: LoggedEntry) => {
    setLogged(entry)
    setPhase('success')
  }, [])

  const handleParseResult = useCallback(
    async (data: ParseReceiptApiResponse) => {
      if (data.success && data.confidence === 'high' && data.entry) {
        const category = normalizeExpenseCategory(data.entry.category)
        showSuccess({
          id: data.entry.id,
          amount: Number(data.entry.amount),
          category,
          subcategory: data.entry.subcategory || getDefaultSubcategory(category),
          description: data.entry.description || data.entry.merchant || category,
          emoji:
            data.entry.emoji ||
            EXPENSE_CATEGORY_EMOJI[category],
        })
        return
      }

      if (data.confidence === 'low' && 'amount' in data && data.amount != null) {
        const options = data.options
        setLowOptions(options)
        setParsed({
          amount: data.amount,
          confidence: 'low',
          is_payment: true,
          category: options[0],
          category_alt: options[1],
          merchant: data.merchant ?? null,
          description: data.description || data.merchant || '',
          subcategory: data.subcategory ?? null,
          emoji: EXPENSE_CATEGORY_EMOJI[options[0]],
        })
        setPhase('low')
        return
      }

      setParsed({
        amount: 'amount' in data ? data.amount ?? null : null,
        confidence: 'none',
        is_payment: false,
        category: 'Other',
        category_alt: null,
        merchant: 'merchant' in data ? data.merchant ?? null : null,
        description: 'description' in data ? data.description || '' : '',
        subcategory: null,
        emoji: EXPENSE_CATEGORY_EMOJI.Other,
      })
      setManualAmount(
        'amount' in data && data.amount != null && data.amount > 0
          ? String(data.amount)
          : ''
      )
      setPhase('manual')
    },
    [showSuccess]
  )

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('primary_currency')
        .eq('id', user.id)
        .single()
      if (profile) setCurrency(getProfileDisplayCurrency(profile))

      const title = searchParams.get('title')?.trim() || ''
      const text = searchParams.get('text')?.trim() || ''
      const url = searchParams.get('url')?.trim() || ''
      const hasFile = searchParams.get('hasFile') === '1'

      let imageBase64: string | null = null
      if (hasFile) {
        const blob = await readSharedFile()
        if (blob) imageBase64 = await fileToBase64(blob)
      }

      const sharedText = [title, text, url].filter(Boolean).join('\n').trim()

      if (!imageBase64 && !sharedText) {
        setPhase('redirecting')
        window.setTimeout(() => router.replace('/home'), 1000)
        return
      }

      try {
        const res = await fetch('/api/parse-receipt', {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify(
            imageBase64
              ? { image: imageBase64 }
              : { text: sharedText, title, url }
          ),
        })
        const data = (await res.json()) as ParseReceiptApiResponse
        await handleParseResult(data)
      } catch (err) {
        console.error('share parse failed:', err)
        setPhase('manual')
      }
    })()
  }, [handleParseResult, router, searchParams, supabase])

  useEffect(() => {
    if (phase !== 'manual') return
    const id = window.setTimeout(() => {
      manualInputRef.current?.focus()
    }, 80)
    return () => window.clearTimeout(id)
  }, [phase])

  const handleUndo = async () => {
    if (!logged?.id) return
    await supabase.from('budget_entries').delete().eq('id', logged.id)
    setPhase('removed')
    // Brief "Removed ✓" then UndoToast / leaveShareOrigin navigates back
    await new Promise((r) => window.setTimeout(r, 600))
  }

  const handleToastDismiss = () => {
    // Toast already navigates via history.back(); keep phase clean
  }

  const handleEditLogged = () => {
    if (!logged?.id) {
      exitShare()
      return
    }
    window.location.href = `/home?edit=${encodeURIComponent(logged.id)}`
  }

  const handlePickCategory = async (category: ExpenseCategory) => {
    if (!parsed?.amount || saving) return
    setSaving(true)
    try {
      const entry = await saveExpense({
        amount: parsed.amount,
        category,
        subcategory: getDefaultSubcategory(category),
        description: parsed.description || parsed.merchant || undefined,
      })
      if (!entry) {
        setPhase('manual')
        return
      }

      if (parsed.merchant) {
        try {
          const res = await fetch('/api/merchant-memory/correct', {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({
              merchant: parsed.merchant,
              category,
              subcategory: getDefaultSubcategory(category),
            }),
          })
          const data = await res.json()
          if (data?.message) setRememberNote(String(data.message))
        } catch {
          /* non-blocking */
        }
      }

      showSuccess(entry)
    } finally {
      setSaving(false)
    }
  }

  const handleManualLog = async () => {
    const amount = parseFloat(manualAmount)
    if (!Number.isFinite(amount) || amount <= 0 || saving) return
    setSaving(true)
    try {
      const category = parsed?.category || 'Other'
      const entry = await saveExpense({
        amount,
        category,
        subcategory: parsed?.subcategory || getDefaultSubcategory(category),
        description: parsed?.description || 'Shared expense',
      })
      if (entry) showSuccess(entry)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: PURPLE,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px 32px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {phase === 'processing' || phase === 'redirecting' ? (
        <div style={{ textAlign: 'center' }}>
          <div
            aria-hidden
            style={{
              fontFamily: 'var(--font-fraunces), Georgia, serif',
              fontSize: 56,
              fontWeight: 600,
              color: GOLD,
              lineHeight: 1,
              animation: 'shareLogoPulse 1.4s ease-in-out infinite',
            }}
          >
            S✦
          </div>
          <p
            style={{
              margin: '20px 0 0',
              fontSize: 15,
              color: 'rgba(255,255,255,0.55)',
              fontWeight: 500,
            }}
          >
            {phase === 'redirecting' ? 'Nothing to log…' : 'Reading your receipt...'}
          </p>
        </div>
      ) : null}

      {phase === 'success' && logged ? (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 360 }}>
          <div
            aria-hidden
            style={{
              fontSize: 64,
              lineHeight: 1,
              marginBottom: 16,
              animation: 'shareCheckPop 0.5s ease-out',
              color: '#4ADE80',
            }}
          >
            ✓
          </div>
          <p
            style={{
              margin: '0 0 8px',
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Logged {logged.emoji}
          </p>
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 40,
              fontWeight: 700,
              color: GOLD,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatMoney(logged.amount, currency)}
          </p>
          <p style={{ margin: '0 0 18px', fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
            {logged.category}
            {logged.subcategory ? ` · ${logged.subcategory}` : ''} · Today
          </p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#4ADE80' }}>
            You&apos;re still okay today ✓
          </p>
          {rememberNote ? (
            <p
              style={{
                margin: '14px 0 0',
                fontSize: 13,
                lineHeight: 1.4,
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              {rememberNote}
            </p>
          ) : null}
        </div>
      ) : null}

      {phase === 'low' && parsed?.amount != null && lowOptions ? (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 360 }}>
          <p
            style={{
              margin: '0 0 8px',
              fontSize: 40,
              fontWeight: 700,
              color: GOLD,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatMoney(parsed.amount, currency)}
          </p>
          <p
            style={{
              margin: '0 0 24px',
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.4,
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            Was this {lowOptions[0]} or {lowOptions[1]}?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handlePickCategory(lowOptions[0])}
              style={choiceBtnStyle}
            >
              {EXPENSE_CATEGORY_EMOJI[lowOptions[0]]} {lowOptions[0]}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handlePickCategory(lowOptions[1])}
              style={choiceBtnStyle}
            >
              {EXPENSE_CATEGORY_EMOJI[lowOptions[1]]} {lowOptions[1]}
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'manual' ? (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 360 }}>
          <p
            style={{
              margin: '0 0 20px',
              fontSize: 18,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            I couldn&apos;t read that clearly
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 16,
              padding: '14px 16px',
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 700, color: GOLD }}>
              {currencySymbol(currency)}
            </span>
            <input
              ref={manualInputRef}
              type="number"
              inputMode="decimal"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              placeholder="0.00"
              aria-label="Amount"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: 32,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                width: '100%',
              }}
            />
          </div>
          <button
            type="button"
            disabled={saving || !manualAmount || parseFloat(manualAmount) <= 0}
            onClick={() => void handleManualLog()}
            style={{
              ...choiceBtnStyle,
              background: GOLD,
              color: PURPLE,
              opacity:
                saving || !manualAmount || parseFloat(manualAmount) <= 0 ? 0.5 : 1,
            }}
          >
            {saving ? 'Logging…' : 'Log it'}
          </button>
        </div>
      ) : null}

      {phase === 'removed' ? (
        <p style={{ fontSize: 22, fontWeight: 700, color: '#4ADE80' }}>Removed ✓</p>
      ) : null}

      {phase === 'success' && logged ? (
        <UndoToast
          amount={logged.amount}
          currency={currency}
          description={logged.description}
          durationSeconds={6}
          onUndo={handleUndo}
          onDismiss={handleToastDismiss}
          onEdit={handleEditLogged}
        />
      ) : null}

      <style>{`
        @keyframes shareLogoPulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes shareCheckPop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

const choiceBtnStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  borderRadius: 14,
  padding: '16px 18px',
  fontSize: 17,
  fontWeight: 700,
  cursor: 'pointer',
  background: 'rgba(255,255,255,0.12)',
  color: '#fff',
}
