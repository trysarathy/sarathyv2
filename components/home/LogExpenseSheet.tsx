'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatRelativeEntryDate, todayInSingapore } from '@/lib/sarathy/sgt'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import {
  EXPENSE_CATEGORY_EMOJI,
  EXPENSE_CATEGORIES,
  getDefaultSubcategory,
  getSubcategories,
  inferSubcategory,
  normalizeExpenseCategory,
} from '@/lib/expense/categories'
import { CURRENCIES } from '@/components/ui/CurrencySelector'
import VoiceMicButton from '@/components/home/VoiceMicButton'
import ExpenseDatePicker from '@/components/home/ExpenseDatePicker'
import {
  getOpenInChromeHref,
  isSpeechRecognitionSupported,
  useSpeechRecognition,
} from '@/lib/voice/speech-recognition'
import { getAuthHeaders } from '@/lib/api-auth'
import { Profile } from '@/types'
import {
  friendlyExpenseSaveError,
  friendlyVoiceParseError,
  friendlyVoicePermissionError,
} from '@/lib/booth/friendly-errors'
import { formatCurrency } from '@/lib/calculations'
import {
  pendingSplitQuery,
  savePendingCircleSplit,
} from '@/lib/circles/pending-split'

interface Props {
  profile: Profile
  onClose: () => void
  onLogged: (xp: number, coords?: { x: number; y: number }) => void | Promise<void>
  /** Open sheet already listening (home mic entry). */
  startInListeningMode?: boolean
}

function xpFloatCoords(el: HTMLElement | null): { x: number; y: number } | undefined {
  if (!el) return undefined
  const rect = el.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top }
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const CATEGORIES = EXPENSE_CATEGORIES.map(value => ({
  emoji: EXPENSE_CATEGORY_EMOJI[value],
  label: value,
  value,
}))

const MOODS = [
  { emoji: '😌', label: 'Good', value: 'good' },
  { emoji: '😰', label: 'Anxious', value: 'anxious' },
  { emoji: '😤', label: 'Stressed', value: 'stressed' },
]

type VoicePhase = 'idle' | 'listening' | 'parsing' | 'confirm'

export default function LogExpenseSheet({
  profile,
  onClose,
  onLogged,
  startInListeningMode = false,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const profileCurrency = getProfileDisplayCurrency(profile)

  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(todayInSingapore())
  const [category, setCategory] = useState('Food')
  const [subcategory, setSubcategory] = useState(() => getDefaultSubcategory('Food'))
  const [description, setDescription] = useState('')
  const [mood, setMood] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [currency, setCurrency] = useState(profileCurrency)
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [loggedSuccess, setLoggedSuccess] = useState<{
    amount: number
    description: string
    category: string
  } | null>(null)

  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle')
  const [voiceError, setVoiceError] = useState('')
  const [voiceErrorIsChromeHint, setVoiceErrorIsChromeHint] = useState(false)
  const [prefillFlash, setPrefillFlash] = useState(false)
  const [heardText, setHeardText] = useState('')
  const [elapsedSec, setElapsedSec] = useState(0)

  const {
    supported: voiceSupported,
    isListening,
    transcript,
    interimTranscript,
    error: recognitionError,
    clearError,
    startListening,
    stopListening,
    abortListening,
    getFullTranscript,
  } = useSpeechRecognition()

  const autoStartedRef = useRef(false)
  const wasListeningRef = useRef(false)
  const parsingRef = useRef(false)
  const saveButtonRef = useRef<HTMLButtonElement>(null)

  const selectedCurrency = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0]
  const profileCurrencyData = CURRENCIES.find(c => c.code === profileCurrency) || CURRENCIES[0]

  const liveTranscript = `${transcript}${interimTranscript}`.trim()

  const showChromeFallback = useCallback((message?: string) => {
    setVoiceErrorIsChromeHint(true)
    setVoiceError(message || friendlyVoicePermissionError('unsupported'))
    setVoicePhase('idle')
  }, [])

  const parseTranscript = useCallback(
    async (text: string) => {
      if (!text.trim() || parsingRef.current) return
      parsingRef.current = true
      setVoicePhase('parsing')
      setVoiceError('')
      setVoiceErrorIsChromeHint(false)
      setHeardText(text.trim())

      try {
        const res = await fetch('/api/parse-voice-expense', {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ transcript: text, currency: profileCurrency }),
        })

        const data = await res.json()
        if (!res.ok || typeof data.amount !== 'number' || data.amount <= 0) {
          setVoiceError(friendlyVoiceParseError(data.error))
          setVoicePhase('idle')
          return
        }

        setAmount(String(data.amount))
        const nextCategory = data.category
          ? normalizeExpenseCategory(data.category)
          : category
        setCategory(nextCategory)
        setSubcategory(
          inferSubcategory(nextCategory, data.description || data.subcategory || '')
        )
        if (data.description) setDescription(data.description)
        setEntryDate(todayInSingapore())

        setPrefillFlash(true)
        window.setTimeout(() => setPrefillFlash(false), 1400)
        setVoicePhase('confirm')
      } catch {
        setVoiceError(friendlyVoiceParseError())
        setVoicePhase('idle')
      } finally {
        parsingRef.current = false
      }
    },
    [profileCurrency]
  )

  const beginListening = useCallback(async () => {
    setVoiceError('')
    setVoiceErrorIsChromeHint(false)
    clearError()

    if (!voiceSupported) {
      showChromeFallback()
      return
    }

    setVoicePhase('listening')
    const ok = await startListening()
    if (!ok) {
      setVoicePhase('idle')
    }
  }, [voiceSupported, startListening, clearError, showChromeFallback])

  const handleMicToggle = useCallback(() => {
    if (isListening || voicePhase === 'listening') {
      stopListening()
      return
    }
    void beginListening()
  }, [isListening, voicePhase, stopListening, beginListening])

  useEffect(() => {
    if (!startInListeningMode || autoStartedRef.current) return
    autoStartedRef.current = true
    // Client-only check after mount — avoids SSR "unsupported" false positive
    if (isSpeechRecognitionSupported()) {
      void beginListening()
    } else {
      showChromeFallback()
    }
  }, [startInListeningMode, beginListening, showChromeFallback])

  useEffect(() => {
    if (wasListeningRef.current && !isListening && voicePhase === 'listening') {
      const text = getFullTranscript()
      if (text) {
        void parseTranscript(text)
      } else {
        setVoicePhase('idle')
        setVoiceError(friendlyVoiceParseError('no transcript'))
      }
    }
    wasListeningRef.current = isListening
  }, [isListening, voicePhase, getFullTranscript, parseTranscript])

  useEffect(() => {
    if (!recognitionError) return
    if (recognitionError === 'unsupported') {
      showChromeFallback()
      return
    }
    setVoiceErrorIsChromeHint(false)
    setVoiceError(friendlyVoicePermissionError(recognitionError))
    setVoicePhase('idle')
  }, [recognitionError, showChromeFallback])

  useEffect(() => {
    if (!isListening) {
      setElapsedSec(0)
      return
    }
    const started = Date.now()
    setElapsedSec(0)
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000))
    }, 250)
    return () => window.clearInterval(id)
  }, [isListening])

  useEffect(() => {
    return () => {
      abortListening()
    }
  }, [abortListening])

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) return
    setSaving(true)
    setSaveError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setSaveError('You need to be signed in to log an expense.')
        return
      }

      const today = todayInSingapore()
      const expenseDate = entryDate && entryDate <= today ? entryDate : today
      let finalAmount = parseFloat(amount)
      const originalAmount = finalAmount
      const originalCurrency = currency

      if (currency !== profileCurrency) {
        try {
          const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`)
          const data = await res.json()
          const rate = data.rates?.[profileCurrency]
          if (rate) {
            finalAmount = parseFloat((parseFloat(amount) * rate).toFixed(2))
          }
        } catch {
          // Use as-is if conversion fails
        }
      }

      if (mood) {
        const { error: moodError } = await supabase.from('mood_logs').upsert(
          {
            user_id: user.id,
            mood,
            entry_date: today,
          },
          { onConflict: 'user_id,entry_date' }
        )
        if (moodError) {
          console.warn('Mood log failed:', moodError.message)
        }
      }

      const row: Record<string, unknown> = {
        user_id: user.id,
        category,
        subcategory,
        amount: finalAmount,
        original_amount: originalAmount,
        original_currency: originalCurrency,
        description: description || subcategory || category,
        entry_date: expenseDate,
        logged_via: 'manual',
      }

      let { error: insertError } = await supabase.from('budget_entries').insert(row)

      // If subcategory column isn't migrated yet, still save the expense
      if (
        insertError &&
        /subcategory/i.test(insertError.message)
      ) {
        delete row.subcategory
        ;({ error: insertError } = await supabase.from('budget_entries').insert(row))
      }

      if (insertError) {
        setSaveError(friendlyExpenseSaveError(insertError.message))
        return
      }

      const xpAward = 10
      const { data: p, error: profileReadError } = await supabase
        .from('profiles')
        .select('total_xp')
        .eq('id', user.id)
        .single()

      if (profileReadError) {
        setSaveError('Expense saved, but XP could not be updated. Refresh the page.')
        return
      }

      const { error: xpError } = await supabase
        .from('profiles')
        .update({ total_xp: (p?.total_xp || 0) + xpAward })
        .eq('id', user.id)

      if (xpError) {
        setSaveError('Expense saved, but XP could not be updated. Refresh the page.')
        return
      }

      await onLogged(xpAward, xpFloatCoords(saveButtonRef.current))
      setLoggedSuccess({
        amount: finalAmount,
        description: description || subcategory || category,
        category,
      })
    } catch (err) {
      console.error(err)
      setSaveError('Something went wrong saving this expense. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSplitWithCircle = () => {
    if (!loggedSuccess) return
    const draft = {
      amount: loggedSuccess.amount,
      description: loggedSuccess.description,
      category: loggedSuccess.category,
    }
    savePendingCircleSplit(draft)
    onClose()
    router.push(`/circles?${pendingSplitQuery(draft)}`)
  }

  const showVoicePanel =
    voicePhase === 'listening' ||
    voicePhase === 'parsing' ||
    voicePhase === 'confirm' ||
    Boolean(voiceError)

  const categoryEmoji =
    EXPENSE_CATEGORY_EMOJI[category as keyof typeof EXPENSE_CATEGORY_EMOJI] || '📌'

  if (loggedSuccess) {
    const successEmoji =
      EXPENSE_CATEGORY_EMOJI[loggedSuccess.category as keyof typeof EXPENSE_CATEGORY_EMOJI] || '✅'
    return (
      <>
        <div className="circles-overlay" onClick={onClose} />
        <div className="log-sheet circles-enter-1">
          <div className="log-sheet-indigo-top">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="circles-kicker text-indigo-muted mb-1">Logged</p>
                <h3 className="font-fraunces text-xl font-semibold text-ink-on-indigo">
                  Expense saved ✨
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-ink-on-indigo/50 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="font-fraunces text-3xl font-semibold text-ink-on-indigo mb-1">
              {formatCurrency(loggedSuccess.amount, profileCurrency)}
            </p>
            <p className="text-sm text-ink-on-indigo/70">
              {successEmoji} {loggedSuccess.description}
            </p>
          </div>

          <p className="text-sm text-ink-3 leading-relaxed mb-4">
            Want to split this with flatmates or friends? Send it to a circle — zero awkwardness.
          </p>

          <button
            type="button"
            onClick={handleSplitWithCircle}
            className="log-sheet-save mb-3"
          >
            Split with circle 👥
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 text-sm font-medium text-ink-3"
          >
            Done
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="circles-overlay" onClick={onClose} />
      <div className="log-sheet circles-enter-1">
        <div className="log-sheet-indigo-top">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="circles-kicker text-indigo-muted mb-1">Quick log</p>
              <h3 className="font-fraunces text-xl font-semibold text-ink-on-indigo">Log expense</h3>
            </div>
            <div className="flex items-center gap-2">
              <VoiceMicButton
                size="sm"
                listening={isListening || voicePhase === 'listening'}
                onClick={handleMicToggle}
                ariaLabel={
                  isListening || voicePhase === 'listening' ? 'Stop listening' : 'Log by voice'
                }
              />
              <button type="button" onClick={onClose} className="text-ink-on-indigo/50 text-2xl leading-none">
                ×
              </button>
            </div>
          </div>

          <div className="flex gap-2 items-center mb-1">
            <button
              type="button"
              onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
              className="log-sheet-currency-btn"
            >
              <span className="text-lg">{selectedCurrency.flag}</span>
              <span className="font-semibold text-sm">{selectedCurrency.code}</span>
              <span className="text-xs opacity-60">▾</span>
            </button>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className={`log-sheet-amount flex-1 ${prefillFlash ? 'voice-prefill-flash rounded-lg' : ''}`}
              inputMode="decimal"
              autoFocus={!startInListeningMode && voicePhase !== 'confirm'}
            />
          </div>

          {showCurrencyPicker && (
            <div className="log-sheet-currency-picker mt-2">
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { setCurrency(c.code); setShowCurrencyPicker(false) }}
                  className={`log-sheet-currency-row ${currency === c.code ? 'log-sheet-currency-row-selected' : ''}`}
                >
                  <span className="text-lg">{c.flag}</span>
                  <span className="font-medium text-indigo text-sm">{c.code}</span>
                  <span className="text-xs text-indigo-muted">{c.name}</span>
                  {currency === c.code && <span className="ml-auto text-gold text-sm">✓</span>}
                </button>
              ))}
            </div>
          )}

          {currency !== profileCurrency && amount && parseFloat(amount) > 0 && (
            <div className="log-sheet-convert-notice mt-2">
              <p className="text-xs text-indigo leading-relaxed">
                Will convert to {profileCurrencyData.code} {profileCurrencyData.symbol} at live rate
              </p>
            </div>
          )}
        </div>

        <div className="mb-4">
          <ExpenseDatePicker
            value={entryDate}
            onChange={setEntryDate}
            max={todayInSingapore()}
          />
        </div>

        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What was this for? (optional)"
          className={`log-sheet-input mb-4 ${prefillFlash ? 'voice-prefill-flash' : ''}`}
        />

        {showVoicePanel && (
          <div className="log-sheet-voice-panel">
            {voicePhase === 'listening' && (
              <div className="flex flex-col items-center text-center gap-2 py-1">
                <VoiceMicButton
                  listening
                  onClick={handleMicToggle}
                  ariaLabel="Stop listening"
                />
                <div className="voice-waveform" aria-hidden>
                  <span /><span /><span /><span /><span />
                </div>
                <p className="log-sheet-voice-label">Listening… {formatElapsed(elapsedSec)}</p>
                <p className="font-fraunces text-sm text-indigo min-h-[2.5rem] leading-relaxed px-2">
                  {liveTranscript || 'Say something like “Lunch at hawker, five dollars”'}
                </p>
                <p className="text-[11px] text-indigo-muted">Tap the mic when you&apos;re done</p>
              </div>
            )}

            {voicePhase === 'parsing' && (
              <div className="flex items-center justify-center gap-2 py-3">
                <span className="w-4 h-4 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-indigo-muted">Understanding…</p>
              </div>
            )}

            {voicePhase === 'confirm' && (
              <div className="voice-confirm-card">
                <p className="log-sheet-voice-label mb-2">Confirm before saving</p>
                {heardText && (
                  <p className="text-[11px] text-indigo-muted mb-2 leading-relaxed">
                    Heard: “{heardText}”
                  </p>
                )}
                <p className="font-fraunces text-lg font-semibold text-indigo mb-1">
                  {formatCurrency(parseFloat(amount) || 0, currency)} · {description || category}
                </p>
                <p className="text-xs text-indigo-muted mb-3">
                  {categoryEmoji} {category}
                  {subcategory ? ` · ${subcategory}` : ''} · {formatRelativeEntryDate(entryDate)}
                </p>
                <p className="text-[11px] text-indigo-muted mb-3">
                  Edit any field below, then tap Log to save.
                </p>
                <button
                  type="button"
                  className="text-xs font-semibold text-coral"
                  onClick={() => {
                    setVoicePhase('idle')
                    void beginListening()
                  }}
                >
                  Re-record
                </button>
              </div>
            )}

            {voiceError && voicePhase === 'idle' && (
              voiceErrorIsChromeHint ? (
                <a
                  href={getOpenInChromeHref()}
                  className="voice-chrome-fallback"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {voiceError}
                </a>
              ) : (
                <p className="text-sm text-danger text-center py-1">{voiceError}</p>
              )
            )}
          </div>
        )}

        <div className="mb-4">
          <p className="log-sheet-section-kicker">Category</p>
          <div className={`grid grid-cols-5 gap-2 rounded-xl ${prefillFlash ? 'voice-prefill-flash p-1 -m-1' : ''}`}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                onClick={() => {
                  setCategory(cat.value)
                  setSubcategory(getDefaultSubcategory(cat.value))
                }}
                className={`log-sheet-category ${
                  category === cat.value
                    ? 'log-sheet-category-selected'
                    : 'log-sheet-category-unselected'
                }`}
              >
                <span className="text-lg">{cat.emoji}</span>
                <span className="text-[10px] font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
          <div className="log-sheet-subcats" role="group" aria-label={`${category} subcategory`}>
            {getSubcategories(category).map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSubcategory(sub)}
                className={`log-sheet-subcat ${
                  subcategory === sub
                    ? 'log-sheet-subcat-selected'
                    : 'log-sheet-subcat-unselected'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="log-sheet-section-kicker">
            How are you feeling? (optional)
          </p>
          <div className="flex gap-2">
            {MOODS.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(mood === m.value ? '' : m.value)}
                className={`log-sheet-mood ${
                  mood === m.value ? 'log-sheet-mood-selected' : 'log-sheet-mood-unselected'
                }`}
              >
                <span className="text-xl">{m.emoji}</span>
                <span className="text-xs">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {saveError && (
          <div className="bg-red-50 text-danger text-sm px-3 py-2.5 rounded-xl mb-4">
            {saveError}
          </div>
        )}

        <button
          type="button"
          ref={saveButtonRef}
          onClick={handleSave}
          className="log-sheet-save"
          disabled={saving || !amount || parseFloat(amount) <= 0}
        >
          {saving
            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : voicePhase === 'confirm'
              ? `Looks good — Log ${selectedCurrency.symbol}${amount || '0'} →`
              : `Log ${selectedCurrency.symbol}${amount || '0'} →`}
        </button>
      </div>
    </>
  )
}
