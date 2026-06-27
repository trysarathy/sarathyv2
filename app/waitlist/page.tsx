'use client'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function WaitlistPage() {
  const supabase = createClient()
  const savingRef = useRef(false)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [form, setForm] = useState({
    name: '',
    email: '',
    user_type: '',
    country_from: '',
    country_now: 'Singapore',
    sends_money_home: '',
    money_stress: '',
    current_tool: '',
    biggest_pain: '',
    feature_excited: '',
    wants_beta: '',
    referral: '',
  })

  const update = (key: string, val: string) => {
    setSubmitError('')
    setForm(p => ({ ...p, [key]: val }))
  }

  const handleSubmit = async () => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSubmitError('')
    try {
      const { error } = await supabase.from('waitlist').insert({
        name: form.name,
        email: form.email,
        user_type: form.user_type,
        country_from: form.country_from,
        country_now: form.country_now,
        sends_money_home: form.sends_money_home === 'Yes',
        money_stress: form.money_stress,
        current_tool: form.current_tool,
        biggest_pain: form.biggest_pain,
        feature_excited: form.feature_excited,
        wants_beta: form.wants_beta === 'Yes',
        referral: form.referral,
      })
      if (error) throw error
      setDone(true)
    } catch (err) {
      console.error(err)
      setSubmitError('Something went wrong joining the list. Please try again in a moment.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const OPTION_BTN = (label: string, field: string, val: string) => (
    <button
      key={val}
      onClick={() => update(field, val)}
      className={`px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all text-left ${
        form[field as keyof typeof form] === val
          ? 'border-saffron bg-saffron text-white'
          : 'border-cream-3 bg-white text-ink'
      }`}
    >
      {label}
    </button>
  )

  if (done) return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-saffron/20 bg-saffron-soft">
        <span className="h-3 w-3 rounded-full bg-saffron" />
      </div>
      <h1 className="font-fraunces text-3xl font-semibold text-ink mb-3">
        You are in.
      </h1>
      <p className="text-ink-3 text-base leading-relaxed mb-6 max-w-xs">
        Thank you {form.name.split(' ')[0]}. Sarathy will reach out to you personally when early access opens.
      </p>
      <p className="text-xs text-ink-3">
        sarathyv2.vercel.app
      </p>
    </div>
  )

  return (
    <div className="min-h-dvh bg-cream">
      <div className="px-6 pt-14 pb-6 bg-plum text-white">
        <p className="text-xs font-medium uppercase tracking-widest text-saffron mb-2">
          Early access
        </p>
        <h1 className="font-fraunces text-3xl font-semibold mb-2">
          Meet Sarathy.
        </h1>
        <p className="text-sm text-white/70 leading-relaxed">
          The WhatsApp of personal finance, built for international students and NRIs in Singapore.
          Answer 8 quick questions and we will be in touch.
        </p>

        <div className="mt-5 h-1.5 bg-white/20 rounded-full">
          <div
            className="h-1.5 bg-saffron rounded-full transition-all duration-500"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
        <p className="text-xs text-white/50 mt-1.5">Step {step} of 4</p>
      </div>

      <div className="px-6 py-6">
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-1">
                Step 1 of 4
              </p>
              <h2 className="font-fraunces text-xl font-semibold text-ink mb-1">
                Tell us about yourself
              </h2>
              <p className="text-sm text-ink-3">No judgment, just context.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2 block">Your name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="First name is fine"
                className="input-field"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2 block">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="your@email.com"
                className="input-field"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2 block">I am a...</label>
              <div className="flex flex-col gap-2">
                {[
                  ['International student in Singapore', 'International student'],
                  ['Young professional / NRI', 'Young professional'],
                  ['Homemaker managing family finances', 'Homemaker'],
                  ['Recently married couple', 'Married couple'],
                  ['Something else', 'Other'],
                ].map(([label, val]) => OPTION_BTN(label, 'user_type', val))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2 block">I am from...</label>
              <input
                type="text"
                value={form.country_from}
                onChange={e => update('country_from', e.target.value)}
                placeholder="India, Vietnam, China..."
                className="input-field"
              />
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!form.name || !form.email || !form.user_type}
              className="btn-primary"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-1">Step 2 of 4</p>
              <h2 className="font-fraunces text-xl font-semibold text-ink mb-1">Your money reality</h2>
              <p className="text-sm text-ink-3">Be honest. This shapes what Sarathy becomes.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2 block">
                Do you send money home regularly?
              </label>
              <div className="flex gap-3">
                {['Yes', 'No', 'Sometimes'].map(v => OPTION_BTN(v, 'sends_money_home', v))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2 block">
                How often do you feel stressed about money?
              </label>
              <div className="flex flex-col gap-2">
                {[
                  ['Almost every day', 'Almost every day'],
                  ['A few times a week', 'A few times a week'],
                  ['Around month-end only', 'Around month-end'],
                  ['Rarely - I have it under control', 'Rarely'],
                ].map(([label, val]) => OPTION_BTN(label, 'money_stress', val))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2 block">
                What do you currently use to manage money?
              </label>
              <div className="flex flex-col gap-2">
                {[
                  ['An app (YNAB, Seedly, etc.)', 'App'],
                  ['A spreadsheet', 'Spreadsheet'],
                  ['Mental math / nothing', 'Nothing'],
                  ['Notes on my phone', 'Notes'],
                ].map(([label, val]) => OPTION_BTN(label, 'current_tool', val))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
              <button
                onClick={() => setStep(3)}
                disabled={!form.money_stress || !form.current_tool}
                className="btn-primary flex-1"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-1">Step 3 of 4</p>
              <h2 className="font-fraunces text-xl font-semibold text-ink mb-1">What keeps you up at night?</h2>
              <p className="text-sm text-ink-3">Pick the one that hits closest to home.</p>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2 block">
                My biggest money pain right now is...
              </label>
              <div className="flex flex-col gap-2">
                {[
                  ['Not knowing if I can afford something', 'Not knowing if I can afford things'],
                  ['Running out before the end of the month', 'Running out before month-end'],
                  ['Sending money home and managing my own expenses', 'Balancing remittance and personal expenses'],
                  ['No idea where my money actually goes', 'No visibility on spending'],
                  ['Feeling guilty every time I spend on myself', 'Guilt around spending'],
                  ['Just generally anxious about money all the time', 'General money anxiety'],
                ].map(([label, val]) => OPTION_BTN(label, 'biggest_pain', val))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2 block">
                The Sarathy feature that excites me most is...
              </label>
              <div className="flex flex-col gap-2">
                {[
                  ['Safe-to-spend number - knowing if I am okay today', 'Safe-to-spend'],
                  ['AI companion - talking to Sarathy like a friend', 'AI companion'],
                  ['Remittance dashboard - best rate to send money home', 'Remittance dashboard'],
                  ['Money psychology - understanding my own patterns', 'Money psychology'],
                  ['Circles - budgeting with people I trust', 'Circles'],
                  ['Future me - seeing where I will be in 6 months', 'Future me'],
                ].map(([label, val]) => OPTION_BTN(label, 'feature_excited', val))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-secondary flex-1">Back</button>
              <button
                onClick={() => setStep(4)}
                disabled={!form.biggest_pain || !form.feature_excited}
                className="btn-primary flex-1"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-1">Step 4 of 4</p>
              <h2 className="font-fraunces text-xl font-semibold text-ink mb-1">Almost there</h2>
              <p className="text-sm text-ink-3">One last thing.</p>
            </div>

            <div className="card bg-saffron-soft border-0">
              <p className="text-sm font-medium text-ink mb-1">Want to be a beta tester?</p>
              <p className="text-xs text-ink-3 leading-relaxed">
                Beta testers get early access, a direct line to the founder, and genuinely shape what Sarathy becomes. It means using the app for 2-4 weeks and giving honest feedback, good and bad.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2 block">
                I want to be a beta tester
              </label>
              <div className="flex gap-3">
                {[
                  ['Yes - sign me up', 'Yes'],
                  ['Not right now', 'No'],
                ].map(([label, val]) => OPTION_BTN(label, 'wants_beta', val))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-2 block">
                How did you hear about Sarathy? (optional)
              </label>
              <input
                type="text"
                value={form.referral}
                onChange={e => update('referral', e.target.value)}
                placeholder="First Sparkle, a friend, LinkedIn..."
                className="input-field"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="btn-secondary flex-1">Back</button>
              <button
                onClick={handleSubmit}
                disabled={saving || !form.wants_beta}
                className="btn-primary flex-1"
              >
                {saving
                  ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : 'Join Sarathy'}
              </button>
            </div>

            {submitError && (
              <p className="text-sm text-red-600 text-center" role="alert">
                {submitError}
              </p>
            )}

            <p className="text-xs text-ink-3 text-center">
              Your responses go directly to the founder. No spam, ever.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
