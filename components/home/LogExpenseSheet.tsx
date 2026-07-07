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

interface Props {
  profile: Profile
  onClose: () => void
  onLogged: (xp: number, x: number, y: number) => void | Promise<void>
  /** Open sheet already listening (home mic entry). */
  startInListeningMode?: boolean
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
          setVoiceError("Didn't catch that")
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
        setVoiceError("Didn't catch that")
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

  const handleSave = async (e: React.MouseEvent<HTMLButtonElement>) => {
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
        setSaveError(insertError.message || 'Could not save this expense. Please try again.')
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

      const rect = e.currentTarget.getBoundingClientRect()
      await onLogged(xpAward, rect.left + rect.width / 2, rect.top)
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
      <div className="overlay" onClick={onClose} />
      <div className="bottom-sheet max-h-[85dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-fraunces text-xl font-semibold text-ink">Log expense</h3>
          <div className="flex items-center gap-2">
            {voiceSupported && (
              <VoiceMicButton
                size="sm"
                listening={isListening}
                onClick={handleMicToggle}
                ariaLabel={isListening ? 'Stop listening' : 'Log by voice'}
              />
            )}
            <button type="button" onClick={onClose} className="text-ink-3 text-2xl leading-none">
              ×
            </button>
          </div>
        </div>

        {voiceSupported && (showVoicePanel || voiceError) && (
          <div className="mb-4 rounded-2xl bg-cream px-4 py-3">
            {voicePhase === 'listening' && (
              <div className="flex flex-col items-center text-center gap-2 py-1">
                <VoiceMicButton listening onClick={handleMicToggle} ariaLabel="Stop listening" />
                <p className="text-xs font-medium text-coral uppercase tracking-wide">Listening…</p>
                <p className="text-sm text-ink min-h-[2.5rem] leading-relaxed">
                  {liveTranscript || 'Say something like “Grab twelve fifty”'}
                </p>
                <p className="text-[11px] text-ink-3">Tap the mic when you&apos;re done</p>
              </div>
            )}

            {voicePhase === 'parsing' && (
              <div className="flex items-center justify-center gap-2 py-3">
                <span className="w-4 h-4 border-2 border-coral border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-ink-3">Understanding…</p>
              </div>
            )}

            {voiceError && voicePhase === 'idle' && (
              <p className="text-sm text-danger text-center py-1">{voiceError}</p>
            )}
          </div>
        )}

        {/* Amount + Currency */}
        <div className="mb-4">
          <div className="flex gap-2 items-center mb-2">
            <button
              type="button"
              onClick={() => setShowCurrencyPicker(!showCurrencyPicker)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-cream rounded-xl border-2 border-transparent active:border-saffron transition-colors flex-shrink-0"
            >
              <span className="text-lg">{selectedCurrency.flag}</span>
              <span className="font-semibold text-ink text-sm">{selectedCurrency.code}</span>
              <span className="text-ink-3 text-xs">▾</span>
            </button>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className={`input-field flex-1 text-2xl font-fraunces ${prefillFlash ? 'voice-prefill-flash rounded-xl' : ''}`}
              inputMode="decimal"
              autoFocus={!startInListeningMode}
            />
          </div>

          {showCurrencyPicker && (
            <div className="bg-white rounded-2xl border border-cream-3 shadow-lg max-h-48 overflow-y-auto mb-2">
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { setCurrency(c.code); setShowCurrencyPicker(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-cream last:border-0 transition-colors ${
                    currency === c.code ? 'bg-saffron-soft' : 'hover:bg-cream'
                  }`}
                >
                  <span className="text-lg">{c.flag}</span>
                  <span className="font-medium text-ink text-sm">{c.code}</span>
                  <span className="text-xs text-ink-3">{c.name}</span>
                  {currency === c.code && <span className="ml-auto text-saffron text-sm">✓</span>}
                </button>
              ))}
            </div>
          )}

          {currency !== profileCurrency && amount && parseFloat(amount) > 0 && (
            <div className="bg-saffron-soft rounded-xl px-3 py-2 mt-1">
              <p className="text-xs text-ink-3">
                Will be converted to {profileCurrencyData.code} {profileCurrencyData.symbol} at live rate and added to your budget
              </p>
            </div>
          )}
        </div>

        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What was this for? (optional)"
          className={`input-field mb-4 ${prefillFlash ? 'voice-prefill-flash rounded-xl' : ''}`}
        />

        <div className="mb-4">
          <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2">Category</p>
          <div className={`grid grid-cols-5 gap-2 rounded-xl ${prefillFlash ? 'voice-prefill-flash p-1 -m-1' : ''}`}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl transition-colors ${
                  category === cat.value
                    ? 'bg-saffron text-white'
                    : 'bg-cream text-ink'
                }`}
              >
                <span className="text-lg">{cat.emoji}</span>
                <span className="text-[10px] font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2">
            How are you feeling? (optional)
          </p>
          <div className="flex gap-2">
            {MOODS.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(mood === m.value ? '' : m.value)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors ${
                  mood === m.value ? 'bg-saffron text-white' : 'bg-cream text-ink'
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
          onClick={handleSave}
          className="btn-primary"
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
