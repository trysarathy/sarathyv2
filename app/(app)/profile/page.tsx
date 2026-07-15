'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Profile } from '@/types'
import { getLevelName, formatCurrency } from '@/lib/calculations'
import { getProfileDisplayCurrency, LIFE_CURRENCIES } from '@/lib/home/display-currency'
import { suggestMonthlyAmount } from '@/lib/dream-goal'
import { saveMonthlySavingsGoal } from '@/lib/savings-goal'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import TabBar from '@/components/ui/TabBar'
import CurrencySelector from '@/components/ui/CurrencySelector'
import LanguagePicker from '@/components/ui/LanguagePicker'
import {
  getLanguageOption,
  normalizePreferredLanguage,
  type PreferredLanguageCode,
} from '@/lib/languages'
import {
  formatNotificationTimeLabel,
  getReminderCopy,
  getToneLabel,
  normalizeNotificationTime,
} from '@/lib/notifications/copy'
import {
  isPushSupported,
  showLocalNotificationPreview,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/notifications/client'
import { getAuthHeaders } from '@/lib/api-auth'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingsGoal, setSavingsGoal] = useState('')
  const [goalName, setGoalName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [monthlyTouched, setMonthlyTouched] = useState(false)
  const [savingGoal, setSavingGoal] = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)
  const [planningAmount, setPlanningAmount] = useState('')
  const [savingPlan, setSavingPlan] = useState(false)
  const [editingPlan, setEditingPlan] = useState(false)
  const [editingDream, setEditingDream] = useState(false)
  const [budgetToast, setBudgetToast] = useState(false)
  const [savingLanguage, setSavingLanguage] = useState(false)
  const [languageSaved, setLanguageSaved] = useState(false)
  const [savingNotifications, setSavingNotifications] = useState(false)
  const [notifyPreview, setNotifyPreview] = useState<{ title: string; body: string } | null>(null)
  const [notifyError, setNotifyError] = useState('')

  const currency = profile ? getProfileDisplayCurrency(profile) : 'SGD'
  const today = todayInSingapore()
  const preferredLanguage = normalizePreferredLanguage(
    profile?.preferred_language ?? profile?.language_preference
  )
  const notificationsEnabled = Boolean(profile?.notifications_enabled)
  const notificationTime = normalizeNotificationTime(profile?.notification_time)

  const suggestion = useMemo(() => {
    const target = parseFloat(targetAmount)
    if (!target || target <= 0 || !targetDate || !profile) return null
    const savedFinalized = profile.goal_saved_amount ?? 0
    const suggested = suggestMonthlyAmount(target, savedFinalized, targetDate, today)
    return { suggested, target }
  }, [targetAmount, targetDate, profile, today])

  useEffect(() => {
    if (suggestion && !monthlyTouched) {
      setSavingsGoal(String(suggestion.suggested))
    }
  }, [suggestion, monthlyTouched])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      const p = data as Profile
      setProfile(p)
      setSavingsGoal(String(p.monthly_savings_goal ?? 0))
      setGoalName(p.goal_name ?? '')
      setTargetAmount(p.goal_target_amount ? String(p.goal_target_amount) : '')
      setTargetDate(p.goal_target_date ?? '')
      setPlanningAmount(p.planning_amount ? String(p.planning_amount) : '')
      setMonthlyTouched(false)
      setEditingPlan(!(p.planning_amount && p.planning_amount > 0))
      setEditingDream(!(p.monthly_savings_goal && p.monthly_savings_goal > 0))
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

  const handleLanguageChange = async (code: PreferredLanguageCode) => {
    if (!profile || code === preferredLanguage) return
    setSavingLanguage(true)
    setLanguageSaved(false)
    const { error } = await supabase
      .from('profiles')
      .update({
        preferred_language: code,
        language_preference: code,
      })
      .eq('id', profile.id)

    if (!error) {
      setProfile((prev) =>
        prev ? { ...prev, preferred_language: code, language_preference: code } : prev
      )
      // Invalidate today's brief so it regenerates in the new language
      await supabase
        .from('daily_briefs')
        .delete()
        .eq('user_id', profile.id)
        .eq('brief_date', todayInSingapore())
      setLanguageSaved(true)
      window.setTimeout(() => setLanguageSaved(false), 2000)
    }
    setSavingLanguage(false)
  }

  const handleNotificationsToggle = async (enabled: boolean) => {
    if (!profile) return
    setSavingNotifications(true)
    setNotifyError('')
    try {
      if (enabled) {
        if (!isPushSupported()) {
          setNotifyError('Push notifications need Chrome or a supported browser (HTTPS).')
          return
        }
        const result = await subscribeToPush()
        if (!result.ok) {
          setNotifyError(result.error)
          return
        }
      } else {
        await unsubscribeFromPush()
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          notifications_enabled: enabled,
          notifications_prompt_seen: true,
        })
        .eq('id', profile.id)

      if (!error) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                notifications_enabled: enabled,
                notifications_prompt_seen: true,
              }
            : prev
        )
      }
    } finally {
      setSavingNotifications(false)
    }
  }

  const handleNotificationTimeChange = async (value: string) => {
    if (!profile) return
    const normalized = normalizeNotificationTime(value)
    setSavingNotifications(true)
    const { error } = await supabase
      .from('profiles')
      .update({ notification_time: `${normalized}:00` })
      .eq('id', profile.id)
    if (!error) {
      setProfile((prev) =>
        prev ? { ...prev, notification_time: `${normalized}:00` } : prev
      )
    }
    setSavingNotifications(false)
  }

  const handlePreviewNotification = async () => {
    if (!profile) return
    setNotifyError('')
    const copy = getReminderCopy(profile.companion_vibe)
    setNotifyPreview(copy)

    const localOk = showLocalNotificationPreview(copy.title, copy.body)
    if (localOk) return

    // Try server push if subscribed
    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: {
          ...(await getAuthHeaders()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preview: true }),
      })
      const data = await res.json()
      if (data.title && data.body) setNotifyPreview({ title: data.title, body: data.body })
    } catch {
      /* in-app preview card is enough */
    }
  }

  const startEditingPlan = () => {
    setPlanningAmount(profile?.planning_amount ? String(profile.planning_amount) : '')
    setEditingPlan(true)
  }

  const cancelEditingPlan = () => {
    setPlanningAmount(profile?.planning_amount ? String(profile.planning_amount) : '')
    setEditingPlan(!(profile?.planning_amount && profile.planning_amount > 0))
  }

  const startEditingDream = () => {
    if (!profile) return
    setSavingsGoal(String(profile.monthly_savings_goal ?? 0))
    setGoalName(profile.goal_name ?? '')
    setTargetAmount(profile.goal_target_amount ? String(profile.goal_target_amount) : '')
    setTargetDate(profile.goal_target_date ?? '')
    setMonthlyTouched(false)
    setEditingDream(true)
  }

  const cancelEditingDream = () => {
    if (!profile) return
    setSavingsGoal(String(profile.monthly_savings_goal ?? 0))
    setGoalName(profile.goal_name ?? '')
    setTargetAmount(profile.goal_target_amount ? String(profile.goal_target_amount) : '')
    setTargetDate(profile.goal_target_date ?? '')
    setMonthlyTouched(false)
    setEditingDream(!(profile.monthly_savings_goal && profile.monthly_savings_goal > 0))
  }

  const handlePlanningSave = async () => {
    if (!profile) return
    const parsed = Math.max(0, Math.round(parseFloat(planningAmount) || 0))
    setSavingPlan(true)
    const { error } = await supabase
      .from('profiles')
      .update({ planning_amount: parsed || null })
      .eq('id', profile.id)
    setSavingPlan(false)
    if (!error) {
      setProfile(prev => prev ? { ...prev, planning_amount: parsed || null } : prev)
      setPlanningAmount(parsed ? String(parsed) : '')
      setEditingPlan(parsed <= 0)
      setBudgetToast(true)
      window.setTimeout(() => setBudgetToast(false), 2000)
    }
  }

  const handleSavingsGoalSave = async () => {
    if (!profile) return
    const parsed = Math.max(0, Math.round(parseFloat(savingsGoal) || 0))
    const parsedTarget = targetAmount ? Math.max(0, Math.round(parseFloat(targetAmount) || 0)) : null
    setSavingGoal(true)
    setGoalSaved(false)
    try {
      await saveMonthlySavingsGoal({
        goal: parsed,
        goalName,
        goalTargetAmount: parsed > 0 ? parsedTarget : null,
        goalTargetDate: parsed > 0 && targetDate ? targetDate : null,
      })
      setProfile(prev => prev ? {
        ...prev,
        monthly_savings_goal: parsed,
        savings_goal_prompt_dismissed: true,
        goal_name: goalName.trim() || null,
        goal_target_amount: parsed > 0 ? parsedTarget : null,
        goal_target_date: parsed > 0 && targetDate ? targetDate : null,
        ...(parsed === 0 ? {
          goal_saved_amount: 0,
          goal_progress_through_month: null,
          goal_started_at: null,
        } : {}),
      } : prev)
      setSavingsGoal(String(parsed))
      setMonthlyTouched(false)
      setEditingDream(parsed <= 0)
      setGoalSaved(true)
      setTimeout(() => setGoalSaved(false), 2000)
    } finally {
      setSavingGoal(false)
    }
  }

  const hasSavedPlan = Boolean(profile?.planning_amount && profile.planning_amount > 0)
  const hasSavedDream = Boolean(profile?.monthly_savings_goal && profile.monthly_savings_goal > 0)

  if (loading || !profile) {
    return (
      <div className="profile-page flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="profile-page">
      <header className="profile-header-zone profile-enter-1">
        <div className="profile-header-inner">
          <p className="circles-kicker mb-1">Account</p>
          <h1 className="profile-title">My profile</h1>
        </div>
      </header>

      <div className="profile-body profile-enter-2">
        <div className="profile-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="profile-avatar">🌸</div>
            <div>
              <p className="font-semibold text-indigo">{profile.name}</p>
              <p className="text-indigo-muted text-xs">{getLevelName(profile.total_xp)}</p>
            </div>
          </div>
          <div className="profile-stat-grid">
            <div className="profile-stat profile-stat-highlight">
              <p className="profile-stat-value">{profile.daily_login_streak}</p>
              <p className="profile-stat-label">day streak 🔥</p>
            </div>
            <div className="profile-stat">
              <p className="profile-stat-value">{profile.total_xp}</p>
              <p className="profile-stat-label">total XP ⚡</p>
            </div>
            <div className="profile-stat">
              <p className="profile-stat-value text-base">
                {profile.planning_amount ? formatCurrency(profile.planning_amount, currency) : '—'}
              </p>
              <p className="profile-stat-label">monthly plan</p>
            </div>
          </div>
          <div className="profile-divider">
            {hasSavedPlan && !editingPlan ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-indigo-muted mb-0.5">Monthly budget / income</p>
                  <p className="text-sm font-semibold text-indigo">
                    {formatCurrency(profile.planning_amount!, currency)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startEditingPlan}
                  className="text-xs text-ink-3 px-2 py-1 rounded-lg bg-cream shrink-0"
                >
                  Edit
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={planningAmount}
                    onChange={(e) => setPlanningAmount(e.target.value)}
                    placeholder="Monthly plan amount"
                    className="profile-input flex-1"
                    autoFocus={editingPlan && hasSavedPlan}
                  />
                  <button
                    type="button"
                    onClick={handlePlanningSave}
                    disabled={savingPlan}
                    className="profile-btn-indigo"
                  >
                    {savingPlan ? 'Saving…' : hasSavedPlan ? 'Save' : 'Set plan'}
                  </button>
                </div>
                {hasSavedPlan && (
                  <button
                    type="button"
                    onClick={cancelEditingPlan}
                    className="text-xs text-indigo-muted self-start"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="profile-dream-card">
          <p className="profile-dream-title">🛡️ Savings dream</p>
          {hasSavedDream && !editingDream ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-indigo truncate">
                    {profile.goal_name?.trim() || 'Savings goal'}
                  </p>
                  <p className="text-xs text-indigo-muted mt-0.5">
                    {formatCurrency(profile.monthly_savings_goal!, currency)}/mo
                    {profile.goal_target_amount ? (
                      <> · {formatCurrency(profile.goal_target_amount, currency)} total</>
                    ) : null}
                    {profile.goal_target_date ? (
                      <> · by {new Date(`${profile.goal_target_date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startEditingDream}
                  className="text-xs text-ink-3 px-2 py-1 rounded-lg bg-cream shrink-0"
                >
                  Edit
                </button>
              </div>
              {profile.goal_saved_amount != null && profile.goal_saved_amount > 0 && (
                <div className="flex items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-indigo-muted">
                    Saved so far:{' '}
                    <span className="font-medium text-indigo">
                      {formatCurrency(profile.goal_saved_amount, currency)}
                    </span>
                  </p>
                </div>
              )}
              <p className="text-xs text-ink-3 leading-relaxed">
                Sarathy treats the monthly amount as already set aside — your safe-to-spend won&apos;t touch it.
              </p>
              {goalSaved && (
                <p className="text-xs text-safe font-medium flex items-center gap-1">
                  <span className="text-gold">✓</span> Saved
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="Name (e.g. Bali fund)"
                  maxLength={80}
                  className="profile-input flex-[2] min-w-0"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={savingsGoal}
                  onChange={(e) => {
                    setMonthlyTouched(true)
                    setSavingsGoal(e.target.value)
                  }}
                  placeholder="/ month"
                  className="profile-input flex-1 min-w-[4.5rem]"
                />
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="How much in total?"
                  className="profile-input flex-1 min-w-0"
                />
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="profile-input flex-1 min-w-0"
                  aria-label="By when?"
                />
                <button
                  type="button"
                  onClick={handleSavingsGoalSave}
                  disabled={savingGoal}
                  className="profile-btn-coral"
                >
                  Save
                </button>
              </div>
              {hasSavedDream && (
                <button
                  type="button"
                  onClick={cancelEditingDream}
                  className="text-xs text-indigo-muted mb-2"
                >
                  Cancel
                </button>
              )}
              {suggestion && !monthlyTouched && (
                <p className="text-xs text-indigo-muted mb-2 leading-relaxed">
                  Suggested {formatCurrency(suggestion.suggested, currency)}/mo to hit{' '}
                  {formatCurrency(suggestion.target, currency)} by{' '}
                  {new Date(`${targetDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              )}
              <p className="text-xs text-ink-3 leading-relaxed">
                Sarathy treats the monthly amount as already set aside — your safe-to-spend won&apos;t touch it. Set monthly to 0 to turn off.
              </p>
              {goalSaved && (
                <p className="text-xs text-safe mt-2 font-medium flex items-center gap-1">
                  <span className="text-gold">✓</span> Saved
                </p>
              )}
            </>
          )}
        </div>

        <div className="profile-card">
          <p className="profile-section-kicker">💱 Primary currency</p>
          <p className="text-xs text-indigo-muted mb-3 leading-relaxed">
            What&apos;s your main currency in Singapore?
          </p>
          <CurrencySelector
            value={getProfileDisplayCurrency(profile)}
            onChange={handleCurrencyChange}
            allowedCodes={[...LIFE_CURRENCIES]}
          />
          <p className="text-xs text-ink-3 mt-2 leading-relaxed">
            Safe-to-spend, the progress bar, and all home amounts use this currency. You can still log expenses in another currency — we convert automatically.
          </p>
        </div>

        <div className="profile-card">
          <p className="profile-section-kicker">🗣️ Language</p>
          <p className="text-xs text-indigo-muted mb-3 leading-relaxed">
            Sarathy replies in{' '}
            <span className="font-semibold text-indigo">
              {getLanguageOption(preferredLanguage).flag}{' '}
              {getLanguageOption(preferredLanguage).label}
            </span>
            {savingLanguage ? ' · Saving…' : ''}
          </p>
          <LanguagePicker
            value={preferredLanguage}
            onChange={(code) => void handleLanguageChange(code)}
            compact
          />
          {languageSaved && (
            <p className="text-xs text-safe mt-2 font-medium flex items-center gap-1">
              <span className="text-gold">✓</span> Language updated
            </p>
          )}
          <p className="text-xs text-ink-3 mt-2 leading-relaxed">
            Ask Sarathy, your daily brief, and personal notes use this language.
          </p>
        </div>

        <div className="profile-card">
          <p className="profile-section-kicker">🔔 Notifications</p>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-indigo">Daily expense reminder</p>
              <p className="text-xs text-indigo-muted mt-0.5 leading-relaxed">
                Sounds like {getToneLabel(profile.companion_vibe)}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificationsEnabled}
              disabled={savingNotifications}
              onClick={() => void handleNotificationsToggle(!notificationsEnabled)}
              className="shrink-0"
              style={{
                width: 48,
                height: 28,
                borderRadius: 999,
                border: 'none',
                padding: 2,
                background: notificationsEnabled ? '#1E1B4B' : '#E8DFC8',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <span
                style={{
                  display: 'block',
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: '#fff',
                  transform: notificationsEnabled ? 'translateX(20px)' : 'translateX(0)',
                  transition: 'transform 0.15s',
                }}
              />
            </button>
          </div>

          <label className="block text-xs font-semibold text-indigo-muted uppercase tracking-wide mb-2">
            Remind me at
          </label>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="time"
              step={300}
              value={notificationTime}
              onChange={(e) => void handleNotificationTimeChange(e.target.value)}
              disabled={savingNotifications}
              className="profile-input"
              style={{ maxWidth: 160 }}
            />
            <span className="text-sm text-indigo-muted">
              {formatNotificationTimeLabel(notificationTime)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void handlePreviewNotification()}
            className="text-sm font-semibold text-indigo underline underline-offset-2"
          >
            See what it&apos;ll sound like →
          </button>

          {notifyPreview && (
            <div
              className="mt-3 rounded-xl border border-cream-border bg-cream-light p-3 text-left"
              role="status"
            >
              <p className="text-xs font-semibold text-indigo-muted uppercase tracking-wide mb-1">
                Preview
              </p>
              <p className="text-sm font-semibold text-indigo">{notifyPreview.title}</p>
              <p className="text-xs text-indigo-muted mt-1 leading-relaxed">{notifyPreview.body}</p>
            </div>
          )}

          {notifyError && (
            <p className="text-xs text-danger mt-2 leading-relaxed">{notifyError}</p>
          )}

          <p className="text-xs text-ink-3 mt-3 leading-relaxed">
            Default is 8:00 PM (Singapore time). Tap a reminder to open Log expense straight away.
          </p>
        </div>

        <div className="profile-settings-list">
          {[
            { label: 'Companion vibe', value: profile.companion_vibe?.replace(/_/g, ' ') || 'calm mentor', emoji: '🧘' },
            { label: 'Home country', value: profile.home_country || 'Not set', emoji: '🌍' },
            { label: 'Responsible for', value: profile.responsible_for || 'Not set', emoji: '❤️' },
            { label: 'Money fear', value: profile.money_fear || 'Not set', emoji: '🧠' },
          ].map((item, i) => (
            <div key={i} className="profile-settings-row">
              <div className="profile-settings-label">
                <span>{item.emoji}</span>
                <span>{item.label}</span>
              </div>
              <span className="profile-settings-value">{item.value}</span>
            </div>
          ))}
        </div>

        <a href="/mydata" className="profile-nav-row">
          <div className="flex items-center gap-3">
            <span className="text-xl">📊</span>
            <div>
              <p className="font-medium text-indigo text-sm">My data</p>
              <p className="text-indigo-muted text-xs">Your profile · Behaviour · Benchmarks</p>
            </div>
          </div>
          <span className="text-indigo/30 text-lg">→</span>
        </a>

        <button type="button" onClick={handleSignOut} className="profile-sign-out">
          Sign out
        </button>
      </div>

      <TabBar active="profile" />

      {budgetToast && (
        <div className="booth-toast" role="status">
          Budget updated ✓
        </div>
      )}
    </div>
  )
}
