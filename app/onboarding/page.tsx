'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const STEPS = 5

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1
  const [name, setName] = useState('')
  // Step 2
  const [vibe, setVibe] = useState<string>('')
  // Step 3
  const [responsibleFor, setResponsibleFor] = useState('')
  const [moneyFear, setMoneyFear] = useState('')
  const [incomeTiming, setIncomeTiming] = useState('')
  // Step 4
  const [totalMoney, setTotalMoney] = useState('')
  const [moneyType, setMoneyType] = useState('')
  const [hasCommitted, setHasCommitted] = useState(false)
  const [committedAmount, setCommittedAmount] = useState('')
  // Step 5 — auto-created goals shown

  const planningAmount = hasCommitted
    ? Math.max(0, parseFloat(totalMoney || '0') - parseFloat(committedAmount || '0'))
    : parseFloat(totalMoney || '0')

  const goNext = () => setStep(s => Math.min(s + 1, STEPS))
  const goPrev = () => setStep(s => Math.max(s - 1, 1))

  const handleFinish = async () => {
    setSaving(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name,
          companion_vibe: vibe,
          responsible_for: responsibleFor,
          money_fear: moneyFear,
          income_timing: incomeTiming,
          total_money: parseFloat(totalMoney) || null,
          money_type: moneyType,
          planning_amount: planningAmount,
          onboarding_complete: true,
          total_xp: 300,
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // Create starter goals based on answers
      const goals = [
        { name: 'Survive this month', emoji: '🗓️', target_amount: planningAmount, user_id: user.id },
      ]
      if (responsibleFor && responsibleFor !== 'Me only') {
        goals.push({ name: 'Family safety fund', emoji: '❤️', target_amount: planningAmount * 0.2, user_id: user.id })
      }
      goals.push({ name: 'Dream fund', emoji: '✨', target_amount: planningAmount * 0.1, user_id: user.id })

      await supabase.from('goals').insert(goals)

      router.replace('/home')
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-dvh bg-cream flex flex-col px-6 pt-12 pb-8">
      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {Array.from({ length: STEPS }).map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i < step ? '#F97316' : '#FDE8D0' }}
          />
        ))}
      </div>

      {/* Step 1 — Name */}
      {step === 1 && (
        <div className="flex flex-col flex-1 page-enter">
          <h2 className="font-fraunces text-2xl font-semibold text-ink mb-2">
            What should I call you?
          </h2>
          <p className="text-ink-3 text-sm mb-8">This is just between us.</p>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            className="input-field text-2xl font-fraunces"
            autoFocus
          />
          {name && (
            <p className="mt-4 text-ink-3 text-sm animate-pulse">
              Nice to meet you, {name} 🌸
            </p>
          )}
          <div className="mt-auto pt-8">
            <button
              className="btn-primary"
              onClick={goNext}
              disabled={!name.trim()}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Companion vibe */}
      {step === 2 && (
        <div className="flex flex-col flex-1 page-enter">
          <h2 className="font-fraunces text-2xl font-semibold text-ink mb-2">
            How do you want me to talk to you?
          </h2>
          <p className="text-ink-3 text-sm mb-8">You can change this anytime.</p>
          <div className="flex flex-col gap-3">
            {[
              { id: 'calm_mentor', emoji: '🧘', title: 'Calm mentor', desc: 'Gentle, reassuring, thoughtful' },
              { id: 'hype_friend', emoji: '🔥', title: 'Hype best friend', desc: 'Energetic, celebratory, warm' },
              { id: 'no_nonsense_sibling', emoji: '💪', title: 'No-nonsense sibling', desc: 'Direct, honest, still kind' },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setVibe(v.id)}
                className={`p-4 rounded-2xl border-2 text-left transition-all ${
                  vibe === v.id
                    ? 'border-saffron bg-saffron-soft'
                    : 'border-transparent bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{v.emoji}</span>
                  <div>
                    <p className="font-semibold text-ink text-sm">{v.title}</p>
                    <p className="text-ink-3 text-xs mt-0.5">{v.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-auto pt-8 flex gap-3">
            <button className="btn-secondary" onClick={goPrev}>← Back</button>
            <button className="btn-primary" onClick={goNext} disabled={!vibe}>Continue →</button>
          </div>
        </div>
      )}

      {/* Step 3 — About you */}
      {step === 3 && (
        <div className="flex flex-col flex-1 page-enter overflow-y-auto">
          <h2 className="font-fraunces text-2xl font-semibold text-ink mb-2">
            Tell me a little about you
          </h2>
          <p className="text-ink-3 text-sm mb-6">This helps me talk to you like I actually know you.</p>

          <div className="flex flex-col gap-6">
            <div>
              <p className="font-medium text-ink text-sm mb-3">Who do you feel responsible for?</p>
              <div className="flex flex-wrap gap-2">
                {['Me only', 'Me & Parents', 'Me & Partner', 'My whole family'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setResponsibleFor(opt)}
                    className={`category-chip ${responsibleFor === opt ? 'selected' : ''}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-medium text-ink text-sm mb-3">What worries you most about money?</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "Not having enough by month-end",
                  "A family member's health",
                  "Debt",
                  "Don't know where it goes"
                ].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setMoneyFear(opt)}
                    className={`category-chip ${moneyFear === opt ? 'selected' : ''}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-medium text-ink text-sm mb-3">When does money usually come in?</p>
              <div className="flex flex-wrap gap-2">
                {['Weekly', 'Monthly', 'Irregular'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setIncomeTiming(opt)}
                    className={`category-chip ${incomeTiming === opt ? 'selected' : ''}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button className="btn-secondary" onClick={goPrev}>← Back</button>
            <button
              className="btn-primary"
              onClick={goNext}
              disabled={!responsibleFor || !moneyFear || !incomeTiming}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Money */}
      {step === 4 && (
        <div className="flex flex-col flex-1 page-enter">
          <h2 className="font-fraunces text-2xl font-semibold text-ink mb-2">
            What's your monthly budget?
          </h2>
          <p className="text-ink-3 text-sm mb-8">Don't worry — this is just for you, never shared.</p>

          <div className="mb-4">
            <input
              type="number"
              value={totalMoney}
              onChange={e => setTotalMoney(e.target.value)}
              placeholder="0"
              className="input-field text-4xl font-fraunces text-center"
              style={{ fontSize: '2.5rem', letterSpacing: '-0.02em' }}
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {['Monthly salary', 'Student stipend', 'Household budget', 'Irregular', 'Lump sum'].map(opt => (
              <button
                key={opt}
                onClick={() => setMoneyType(opt)}
                className={`category-chip ${moneyType === opt ? 'selected' : ''}`}
              >
                {opt}
              </button>
            ))}
          </div>

          <button
            onClick={() => setHasCommitted(!hasCommitted)}
            className="flex items-center gap-3 text-sm text-ink-3 mb-4"
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
              hasCommitted ? 'bg-saffron border-saffron' : 'border-ink-3'
            }`}>
              {hasCommitted && <span className="text-white text-xs">✓</span>}
            </div>
            Some is already committed (investments, rent, etc.)
          </button>

          {hasCommitted && (
            <div className="mb-4">
              <label className="text-sm text-ink-3 mb-2 block">How much is already committed?</label>
              <input
                type="number"
                value={committedAmount}
                onChange={e => setCommittedAmount(e.target.value)}
                placeholder="0"
                className="input-field"
              />
              {totalMoney && committedAmount && (
                <p className="text-sm text-saffron mt-2 font-medium">
                  Planning amount: {parseFloat(totalMoney) - parseFloat(committedAmount)} left for you
                </p>
              )}
            </div>
          )}

          <div className="mt-auto flex gap-3">
            <button className="btn-secondary" onClick={goPrev}>← Back</button>
            <button
              className="btn-primary"
              onClick={goNext}
              disabled={!totalMoney || !moneyType}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 5 — Goals preview */}
      {step === 5 && (
        <div className="flex flex-col flex-1 page-enter">
          <h2 className="font-fraunces text-2xl font-semibold text-ink mb-2">
            I&apos;ve set these up for you 🌟
          </h2>
          <p className="text-ink-3 text-sm mb-6">Rename or remove them anytime.</p>

          {(totalMoney || planningAmount > 0) && (
            <div className="card flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs text-ink-3 mb-0.5">Monthly budget / income</p>
                <p className="font-semibold text-ink text-sm">
                  {planningAmount.toLocaleString()}
                  {moneyType ? ` · ${moneyType}` : ''}
                </p>
                {hasCommitted && committedAmount && (
                  <p className="text-xs text-ink-3 mt-0.5">
                    {committedAmount} already committed
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="text-xs text-ink-3 px-2 py-1 rounded-lg bg-cream shrink-0"
              >
                Edit
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3 mb-8">
            <div className="card flex items-center gap-3">
              <span className="text-2xl">🗓️</span>
              <div>
                <p className="font-semibold text-ink text-sm">Survive this month</p>
                <p className="text-ink-3 text-xs">Month-to-month safety</p>
              </div>
            </div>
            {responsibleFor && responsibleFor !== 'Me only' && (
              <div className="card flex items-center gap-3">
                <span className="text-2xl">❤️</span>
                <div>
                  <p className="font-semibold text-ink text-sm">Family safety fund</p>
                  <p className="text-ink-3 text-xs">For the people you care about</p>
                </div>
              </div>
            )}
            <div className="card flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <div>
                <p className="font-semibold text-ink text-sm">Dream fund</p>
                <p className="text-ink-3 text-xs">Just for you</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-danger text-sm px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <div className="mt-auto flex gap-3">
            <button className="btn-secondary" onClick={goPrev}>← Back</button>
            <button className="btn-primary" onClick={handleFinish} disabled={saving}>
              {saving ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : "I'm ready 🌸"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
