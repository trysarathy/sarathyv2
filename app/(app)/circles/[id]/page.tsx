'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/calculations'
import { claimCircleSplit } from '@/lib/circles/client'
import { isExpenseSplitContent, shareForUser } from '@/lib/circles/split-expense'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import SplitExpenseSheet from '@/components/circles/SplitExpenseSheet'
import TabBar from '@/components/ui/TabBar'
import type {
  CircleMemberWithProfile,
  CircleMoment,
  ExpenseSplitContent,
} from '@/types'

const REACTIONS = ['🎉', '💪', '😮', '❤️', '🌸']

const MOMENT_TYPES = [
  { type: 'streak', label: 'Share my streak', emoji: '🔥' },
  { type: 'checkin', label: 'Weekly check-in', emoji: '✅' },
  { type: 'goal', label: 'Goal progress', emoji: '🎯' },
  { type: 'win', label: 'Share a win', emoji: '🏆' },
]

function memberLabel(m: CircleMemberWithProfile): string {
  return m.display_name?.trim() || m.name?.trim() || 'Member'
}

export default function CirclePage() {
  const router = useRouter()
  const params = useParams()
  const circleId = params.id as string
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [circle, setCircle] = useState<{ id: string; name: string; invite_code: string } | null>(null)
  const [moments, setMoments] = useState<CircleMoment[]>([])
  const [members, setMembers] = useState<CircleMemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState<{ name: string | null; daily_login_streak: number; primary_currency: string } | null>(null)
  const [showShare, setShowShare] = useState(false)
  const [showSplit, setShowSplit] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [claimedMomentIds, setClaimedMomentIds] = useState<Set<string>>(new Set())
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)

  const currency = profile ? getProfileDisplayCurrency(profile) : 'SGD'

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    setUserId(user.id)

    const [circleRes, momentsRes, membersRes, profileRes] = await Promise.all([
      supabase.from('circles').select('id, name, invite_code').eq('id', circleId).single(),
      supabase.from('circle_moments').select('*').eq('circle_id', circleId).order('created_at', { ascending: true }),
      supabase
        .from('circle_members')
        .select('user_id, display_name, profiles(name)')
        .eq('circle_id', circleId),
      supabase.from('profiles').select('name, daily_login_streak, primary_currency').eq('id', user.id).single(),
    ])

    if (circleRes.data) setCircle(circleRes.data)
    const loadedMoments = (momentsRes.data || []) as CircleMoment[]
    setMoments(loadedMoments)

    const mappedMembers: CircleMemberWithProfile[] = (membersRes.data || []).map((row: {
      user_id: string
      display_name: string | null
      profiles: { name: string | null } | { name: string | null }[] | null
    }) => {
      const p = row.profiles
      const profileName = Array.isArray(p) ? p[0]?.name ?? null : p?.name ?? null
      return {
        user_id: row.user_id,
        display_name: row.display_name,
        name: profileName,
      }
    })
    setMembers(mappedMembers)

    if (profileRes.data) setProfile(profileRes.data)

    const splitIds = loadedMoments.filter(m => m.type === 'expense_split').map(m => m.id)
    if (splitIds.length > 0) {
      const { data: claims } = await supabase
        .from('budget_entries')
        .select('source_circle_moment_id')
        .eq('user_id', user.id)
        .in('source_circle_moment_id', splitIds)

      setClaimedMomentIds(
        new Set((claims ?? []).map(c => c.source_circle_moment_id as string).filter(Boolean))
      )
    } else {
      setClaimedMomentIds(new Set())
    }

    setLoading(false)
  }, [circleId, router, supabase])

  useEffect(() => { load() }, [load])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [moments])

  const memberName = (id: string) => {
    const m = members.find(x => x.user_id === id)
    return m ? memberLabel(m) : 'Someone'
  }

  const handleShare = async (type: string) => {
    setSharing(true)
    try {
      let content: Record<string, unknown> = {}
      if (type === 'streak') {
        content = { streak: profile?.daily_login_streak || 0, message: `${profile?.daily_login_streak || 0} day streak 🔥` }
      } else if (type === 'checkin') {
        content = { status: 'on_track', message: 'Checked in for the week ✅' }
      } else if (type === 'goal') {
        content = { message: 'Working towards my goal 🎯', progress: '—' }
      } else if (type === 'win') {
        content = { message: 'Had a good money week 🏆' }
      }

      await supabase.from('circle_moments').insert({
        circle_id: circleId,
        sender_id: userId,
        type,
        content,
      })

      setShowShare(false)
      load()
    } finally { setSharing(false) }
  }

  const handleReact = async (momentId: string, emoji: string, currentReactions: string[]) => {
    const updated = currentReactions.includes(emoji)
      ? currentReactions.filter(r => r !== emoji)
      : [...currentReactions, emoji]

    await supabase.from('circle_moments')
      .update({ reactions: updated })
      .eq('id', momentId)

    setMoments(prev => prev.map(m =>
      m.id === momentId ? { ...m, reactions: updated } : m
    ))
  }

  const handleClaimFromFeed = async (momentId: string) => {
    setClaimingId(momentId)
    setClaimError(null)
    try {
      await claimCircleSplit(momentId)
      setClaimedMomentIds(prev => new Set(prev).add(momentId))
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Could not add share')
    } finally {
      setClaimingId(null)
    }
  }

  const copyInviteCode = () => {
    if (circle?.invite_code) {
      navigator.clipboard.writeText(circle.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const renderExpenseSplitCard = (moment: CircleMoment, isMe: boolean) => {
    if (!isExpenseSplitContent(moment.content)) return null
    const content = moment.content as ExpenseSplitContent
    const senderName = memberName(moment.sender_id)
    const myShare = shareForUser(content, userId)
    const isParticipant = myShare != null
    const claimed = claimedMomentIds.has(moment.id)

    return (
      <div key={moment.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-xs rounded-2xl p-3 ${isMe ? 'bg-saffron text-white' : 'bg-white shadow-sm'}`}>
          <div className="flex items-start gap-2 mb-1">
            <span className="text-lg shrink-0">🍽️</span>
            <div>
              <p className={`text-sm font-medium ${isMe ? 'text-white' : 'text-ink'}`}>
                {senderName} added {content.description}{' '}
                {formatCurrency(content.total_amount, content.currency)}
              </p>
              <p className={`text-xs mt-0.5 ${isMe ? 'text-white/70' : 'text-ink-3'}`}>
                Split {content.split_count} ways
              </p>
              {isParticipant && (
                <p className={`text-xs mt-1 font-semibold ${isMe ? 'text-white' : 'text-ink'}`}>
                  Your share: {formatCurrency(myShare, content.currency)}
                </p>
              )}
            </div>
          </div>

          {isParticipant && (
            claimed ? (
              <p className={`text-xs mt-2 font-medium ${isMe ? 'text-white/90' : 'text-safe'}`}>
                ✓ Added to your expenses
              </p>
            ) : (
              <button
                type="button"
                onClick={() => handleClaimFromFeed(moment.id)}
                disabled={claimingId === moment.id}
                className={`mt-2 w-full py-2 rounded-xl text-xs font-semibold ${
                  isMe
                    ? 'bg-white text-saffron'
                    : 'bg-saffron-soft text-saffron'
                } disabled:opacity-50`}
              >
                {claimingId === moment.id
                  ? 'Adding…'
                  : `Add my ${formatCurrency(myShare, content.currency)} to my expenses`}
              </button>
            )
          )}

          <div className="flex gap-1 mt-2 flex-wrap">
            {REACTIONS.map(emoji => {
              const count = (moment.reactions || []).filter((r: string) => r === emoji).length
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReact(moment.id, emoji, moment.reactions || [])}
                  className={`text-sm px-2 py-0.5 rounded-full transition-colors ${
                    count > 0
                      ? 'bg-saffron-soft text-ink'
                      : isMe ? 'bg-white/20 text-white' : 'bg-cream text-ink-3'
                  }`}
                >
                  {emoji}{count > 0 ? ` ${count}` : ''}
                </button>
              )
            })}
          </div>
          <p className={`text-xs mt-1 ${isMe ? 'text-white/50' : 'text-ink-3'}`}>
            {new Date(moment.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    )
  }

  const getMomentCard = (moment: CircleMoment) => {
    const isMe = moment.sender_id === userId

    if (moment.type === 'expense_split') {
      return renderExpenseSplitCard(moment, isMe)
    }

    const emojis: Record<string, string> = {
      streak: '🔥', checkin: '✅', goal: '🎯', win: '🏆'
    }
    const content = moment.content as { message?: string; streak?: number }

    return (
      <div key={moment.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-xs rounded-2xl p-3 ${isMe ? 'bg-saffron text-white' : 'bg-white shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{emojis[moment.type] || '💰'}</span>
            <p className={`text-sm font-medium ${isMe ? 'text-white' : 'text-ink'}`}>
              {content.message}
            </p>
          </div>
          {content.streak != null && (
            <p className={`text-xs ${isMe ? 'text-white/70' : 'text-ink-3'}`}>
              {content.streak} days
            </p>
          )}
          <div className="flex gap-1 mt-2 flex-wrap">
            {REACTIONS.map(emoji => {
              const count = (moment.reactions || []).filter((r: string) => r === emoji).length
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleReact(moment.id, emoji, moment.reactions || [])}
                  className={`text-sm px-2 py-0.5 rounded-full transition-colors ${
                    count > 0
                      ? 'bg-saffron-soft text-ink'
                      : isMe ? 'bg-white/20 text-white' : 'bg-cream text-ink-3'
                  }`}
                >
                  {emoji}{count > 0 ? ` ${count}` : ''}
                </button>
              )
            })}
          </div>
          <p className={`text-xs mt-1 ${isMe ? 'text-white/50' : 'text-ink-3'}`}>
            {new Date(moment.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    )
  }

  if (loading) return (
    <div className="min-h-dvh bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-dvh bg-cream flex flex-col">
      <div className="px-5 pt-12 pb-3 bg-cream border-b border-cream-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => router.push('/circles')} className="text-ink-3 text-xl">←</button>
            <div>
              <h1 className="font-fraunces text-lg font-semibold text-ink">{circle?.name}</h1>
              <p className="text-ink-3 text-xs">{members.length} member{members.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button type="button" onClick={copyInviteCode}
            className="text-xs font-medium px-3 py-1.5 rounded-xl bg-saffron-soft text-saffron">
            {copied ? 'Copied! ✓' : `Code: ${circle?.invite_code}`}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-44">
        {moments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">🌸</p>
            <p className="font-medium text-ink mb-1">Nothing shared yet</p>
            <p className="text-ink-3 text-sm">
              Share a money moment or split an expense with your circle.
            </p>
          </div>
        ) : (
          <>
            {moments.map(getMomentCard)}
            {claimError && (
              <p className="text-xs text-danger text-center mb-2">{claimError}</p>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-16 left-0 right-0 px-5 pb-2 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowSplit(true)}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold bg-white border border-saffron-soft text-saffron"
        >
          Split an expense 🍽️
        </button>
        <button type="button" onClick={() => setShowShare(true)} className="btn-primary">
          Share a moment 🌸
        </button>
      </div>

      {showSplit && (
        <SplitExpenseSheet
          circleId={circleId}
          members={members}
          currentUserId={userId}
          currency={currency}
          onClose={() => setShowSplit(false)}
          onComplete={load}
        />
      )}

      {showShare && (
        <>
          <div className="overlay" onClick={() => setShowShare(false)} />
          <div className="bottom-sheet">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-fraunces text-xl font-semibold text-ink">Share a moment</h3>
              <button type="button" onClick={() => setShowShare(false)} className="text-ink-3 text-2xl">×</button>
            </div>
            <p className="text-ink-3 text-sm mb-4">
              These moments stay amount-free — only splits show totals to the circle.
            </p>
            <div className="flex flex-col gap-3">
              {MOMENT_TYPES.map(m => (
                <button
                  key={m.type}
                  type="button"
                  onClick={() => handleShare(m.type)}
                  disabled={sharing}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-cream active:bg-saffron-soft transition-colors text-left"
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <p className="font-medium text-ink text-sm">{m.label}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <TabBar active="circles" />
    </div>
  )
}
