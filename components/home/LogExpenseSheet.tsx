'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import { EXPENSE_CATEGORY_EMOJI, EXPENSE_CATEGORIES } from '@/lib/expense/categories'
import { CURRENCIES } from '@/components/ui/CurrencySelector'
import VoiceMicButton from '@/components/home/VoiceMicButton'
import { useSpeechRecognition } from '@/lib/voice/speech-recognition'
import { getAuthHeaders } from '@/lib/api-auth'
import { Profile } from '@/types'
import {
  friendlyExpenseSaveError,
  friendlyVoiceParseError,
} from '@/lib/booth/friendly-errors'

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

type VoicePhase = 'idle' | 'listening' | 'parsing'

export default function LogExpenseSheet({
  profile,
  onClose,
  onLogged,
  startInListeningMode = false,
}: Props) {
  const supabase = createClient()
  const profileCurrency = getProfileDisplayCurrency(profile)

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [description, setDescription] = useState('')
  const [mood, setMood] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [currency, setCurrency] = useState(profileCurrency)
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)

  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle')
  const [voiceError, setVoiceError] = useState('')
  const [prefillFlash, setPrefillFlash] = useState(false)

  const {
    supported: voiceSupported,
    isListening,
    transcript,
    interimTranscript,
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

  const parseTranscript = useCallback(
    async (text: string) => {
      if (!text.trim() || parsingRef.current) return
      parsingRef.current = true
      setVoicePhase('parsing')
      setVoiceError('')

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
        if (data.category) setCategory(data.category)
        if (data.description) setDescription(data.description)

        setPrefillFlash(true)
        window.setTimeout(() => setPrefillFlash(false), 1200)
        setVoicePhase('idle')
      } catch {
        setVoiceError(friendlyVoiceParseError())
        setVoicePhase('idle')
      } finally {
        parsingRef.current = false
      }
    },
    [profileCurrency]
  )

  const handleMicToggle = useCallback(() => {
    setVoiceError('')
    if (isListening) {
      stopListening()
      return
    }
    setVoicePhase('listening')
    startListening()
  }, [isListening, startListening, stopListening])

  useEffect(() => {
    if (startInListeningMode && voiceSupported && !autoStartedRef.current) {
      autoStartedRef.current = true
      setVoicePhase('listening')
      startListening()
    }
  }, [startInListeningMode, voiceSupported, startListening])

  useEffect(() => {
    if (wasListeningRef.current && !isListening && voicePhase === 'listening') {
      const text = getFullTranscript()
      if (text) {
        void parseTranscript(text)
      } else {
        setVoicePhase('idle')
      }
    }
    wasListeningRef.current = isListening
  }, [isListening, voicePhase, getFullTranscript, parseTranscript])

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

      const entryDate = todayInSingapore()
      let finalAmount = parseFloat(amount)
      let originalAmount = finalAmount
      let originalCurrency = currency

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
            entry_date: entryDate,
          },
          { onConflict: 'user_id,entry_date' }
        )
        if (moodError) {
          console.warn('Mood log failed:', moodError.message)
        }
      }

      const { error: insertError } = await supabase.from('budget_entries').insert({
        user_id: user.id,
        category,
        amount: finalAmount,
        original_amount: originalAmount,
        original_currency: originalCurrency,
        description: description || category,
        entry_date: entryDate,
        logged_via: 'manual',
      })

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
      onClose()
    } catch (err) {
      console.error(err)
      setSaveError('Something went wrong saving this expense. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const showVoicePanel =
    voiceSupported &&
    (voicePhase === 'listening' || voicePhase === 'parsing' || Boolean(voiceError))

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
              {voiceSupported && (
                <VoiceMicButton
                  size="sm"
                  listening={isListening}
                  onClick={handleMicToggle}
                  ariaLabel={isListening ? 'Stop listening' : 'Log by voice'}
                />
              )}
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
              autoFocus={!startInListeningMode}
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

        {voiceSupported && (showVoicePanel || voiceError) && (
          <div className="log-sheet-voice-panel">
            {voicePhase === 'listening' && (
              <div className="flex flex-col items-center text-center gap-2 py-1">
                <VoiceMicButton listening onClick={handleMicToggle} ariaLabel="Stop listening" />
                <p className="log-sheet-voice-label">Listening…</p>
                <p className="font-fraunces text-sm text-indigo min-h-[2.5rem] leading-relaxed px-2">
                  {liveTranscript || 'Say something like “Grab twelve fifty”'}
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

            {voiceError && voicePhase === 'idle' && (
              <p className="text-sm text-danger text-center py-1">{voiceError}</p>
            )}
          </div>
        )}

        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What was this for? (optional)"
          className={`log-sheet-input mb-4 ${prefillFlash ? 'voice-prefill-flash' : ''}`}
        />

        <div className="mb-4">
          <p className="log-sheet-section-kicker">Category</p>
          <div className={`grid grid-cols-5 gap-2 rounded-xl ${prefillFlash ? 'voice-prefill-flash p-1 -m-1' : ''}`}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
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
            : `Log ${selectedCurrency.symbol}${amount || '0'} →`}
        </button>
      </div>
    </>
  )
}
