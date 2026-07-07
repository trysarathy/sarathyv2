'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/types'
import { getLevelName, formatCurrency } from '@/lib/calculations'
import { getProfileDisplayCurrency, LIFE_CURRENCIES } from '@/lib/home/display-currency'
import { saveMonthlySavingsGoal } from '@/lib/savings-goal'
import TabBar from '@/components/ui/TabBar'
import CurrencySelector from '@/components/ui/CurrencySelector'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingsGoal, setSavingsGoal] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setProfile(data as Profile)
      setSavingsGoal(String((data as Profile).monthly_savings_goal ?? 0))
    }
    setLoading(false)
  }

  useEffect(() => { loadProfile() }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const handleCurrencyChange = async (code: string) => {
    if (!profile) return
    await supabase.from('profiles').update({ primary_currency: code }).eq('id', profile.id)
    setProfile(prev => prev ? { ...prev, primary_currency: code } : prev)
  }

  const handleSavingsGoalSave = async () => {
    if (!profile) return
    const parsed = Math.max(0, Math.round(parseFloat(savingsGoal) || 0))
    setSavingGoal(true)
    setGoalSaved(false)
    try {
      await saveMonthlySavingsGoal(parsed)
      setProfile(prev => prev ? {
        ...prev,
        monthly_savings_goal: parsed,
        savings_goal_prompt_dismissed: true,
      } : prev)
      setSavingsGoal(String(parsed))
      setGoalSaved(true)
      setTimeout(() => setGoalSaved(false), 2000)
    } finally {
      setSavingGoal(false)
    }
  }

  if (loading || !profile) {
    return (
      <div className="min-h-dvh bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-cream pb-24 px-5 pt-12">
      <h1 className="font-fraunces text-2xl font-semibold text-ink mb-6">My profile</h1>

      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-saffron-soft rounded-full flex items-center justify-center text-2xl">
            🌸
          </div>
          <div>
            <p className="font-semibold text-ink">{profile.name}</p>
            <p className="text-ink-3 text-xs">{getLevelName(profile.total_xp)}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="font-fraunces text-xl font-semibold text-ink">{profile.daily_login_streak}</p>
            <p className="text-xs text-ink-3">day streak 🔥</p>
          </div>
          <div className="text-center">
            <p className="font-fraunces text-xl font-semibold text-ink">{profile.total_xp}</p>
            <p className="text-xs text-ink-3">total XP ⚡</p>
          </div>
          <div className="text-center">
            <p className="font-fraunces text-xl font-semibold text-ink">
              {profile.planning_amount ? formatCurrency(profile.planning_amount, profile.primary_currency) : '—'}
            </p>
            <p className="text-xs text-ink-3">monthly plan</p>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">
          🛡️ Monthly savings goal
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="1"
            value={savingsGoal}
            onChange={(e) => setSavingsGoal(e.target.value)}
            className="input-field flex-1 py-2.5 text-sm"
          />
          <button
            onClick={handleSavingsGoalSave}
            disabled={savingGoal}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-saffron disabled:opacity-50"
          >
            Save
          </button>
        </div>
        <p className="text-xs text-ink-3 mt-2">
          Sarathy treats this as already set aside — your safe-to-spend won&apos;t touch it. Set to 0 to turn off.
        </p>
        {goalSaved && (
          <p className="text-xs text-safe mt-2 font-medium">Saved ✓</p>
        )}
      </div>

      <div className="card mb-4">
        <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">
          💱 Primary currency
        </p>
        <CurrencySelector
          value={getProfileDisplayCurrency(profile)}
          onChange={handleCurrencyChange}
          allowedCodes={[...LIFE_CURRENCIES]}
        />
        <p className="text-xs text-ink-3 mt-2">
          Your safe-to-spend and all expenses display in this currency. You can log in any currency and we convert automatically.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
        {[
          { label: 'Companion vibe', value: profile.companion_vibe?.replace(/_/g, ' ') || 'calm mentor', emoji: '🧘' },
          { label: 'Home country', value: profile.home_country || 'Not set', emoji: '🌍' },
          { label: 'Responsible for', value: profile.responsible_for || 'Not set', emoji: '❤️' },
          { label: 'Money fear', value: profile.money_fear || 'Not set', emoji: '🧠' },
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3.5 border-b border-cream last:border-0">
            <div className="flex items-center gap-2">
              <span>{item.emoji}</span>
              <span className="text-sm text-ink">{item.label}</span>
            </div>
            <span className="text-sm text-ink-3 capitalize">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <a href="/mydata" className="card flex items-center justify-between active:opacity-70">
          <div className="flex items-center gap-3">
            <span className="text-xl">📊</span>
            <div>
              <p className="font-medium text-ink text-sm">My data</p>
              <p className="text-ink-3 text-xs">Your profile · Behaviour · Benchmarks</p>
            </div>
          </div>
          <span className="text-ink-3">→</span>
        </a>
      </div>

      <button
        onClick={handleSignOut}
        className="w-full py-3.5 rounded-2xl text-sm font-medium text-danger bg-red-50 border border-red-100"
      >
        Sign out
      </button>

      <TabBar active="profile" />
    </div>
  )
}
