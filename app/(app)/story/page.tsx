'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Profile, Goal } from '@/types'
import { formatCurrency, getLevelName } from '@/lib/calculations'
import TabBar from '@/components/ui/TabBar'

export default function StoryPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const [profileRes, goalsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('goals').select('*').eq('user_id', user.id),
      ])
      if (profileRes.data) setProfile(profileRes.data as Profile)
      setGoals((goalsRes.data || []) as Goal[])
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !profile) {
    return (
      <div className="min-h-dvh bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const currency = profile.primary_currency || 'SGD'

  return (
    <div className="min-h-dvh bg-cream pb-24 px-5 pt-12">
      <div className="mb-6">
        <h1 className="font-fraunces text-2xl font-semibold text-ink">My Story</h1>
        <p className="text-ink-3 text-sm mt-1">Your financial journey, in your words.</p>
      </div>

      {/* Persona card */}
      <div className="bg-gradient-to-br from-saffron to-orange-600 rounded-2xl p-5 text-white mb-4">
        <p className="text-xs font-medium opacity-75 mb-1">Your financial persona</p>
        <p className="font-fraunces text-xl font-semibold mb-1">The {getLevelName(profile.total_xp)}</p>
        <p className="text-xs opacity-75">{profile.total_xp} XP · Level {profile.level}</p>
      </div>

      {/* Goals */}
      <div className="mb-4">
        <p className="font-semibold text-ink text-sm mb-3">Your goals</p>
        <div className="flex flex-col gap-3">
          {goals.length === 0 ? (
            <div className="card text-center text-ink-3 text-sm py-6">
              No goals yet — ask Sarathy to help you set one 🎯
            </div>
          ) : (
            goals.map(goal => {
              const progress = goal.target_amount > 0
                ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
                : 0
              return (
                <div key={goal.id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{goal.emoji}</span>
                      <p className="font-medium text-ink text-sm">{goal.name}</p>
                    </div>
                    <span className="text-xs font-semibold text-saffron">{progress}%</span>
                  </div>
                  <div className="meter-bar mb-2">
                    <div
                      className="meter-fill"
                      style={{ width: `${progress}%`, background: '#F97316' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-ink-3">
                    <span>{formatCurrency(goal.current_amount, currency)}</span>
                    <span>{formatCurrency(goal.target_amount, currency)}</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Letter placeholder */}
      <div className="card border-2 border-dashed border-saffron/30">
        <p className="text-xs font-medium text-saffron mb-2">📝 Monthly letter</p>
        <p className="text-ink-3 text-sm">
          Sarathy will write you a personal letter at the end of your first month.
          Come back then 🌸
        </p>
      </div>

      <TabBar active="story" />
    </div>
  )
}
