'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/calculations'
import { claimCircleSplit } from '@/lib/circles/client'
import { isExpenseSplitContent, shareForUser } from '@/lib/circles/split-expense'
import {
  clearPendingCircleSplit,
  parsePendingSplitFromSearch,
  type PendingCircleSplit,
} from '@/lib/circles/pending-split'
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
  return (
    <Suspense
      fallback={
        <div className="circles-page flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CirclePageInner />
    </Suspense>
  )
}

function CirclePageInner() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const circleId = params.id as string
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const openedSplitRef = useRef(false)

  const [circle, setCircle] = useState<{ id: string; name: string; invite_code: string } | null>(null)
  const [moments, setMoments] = useState<CircleMoment[]>([])
  const [members, setMembers] = useState<CircleMemberWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState<{ name: string | null; daily_login_streak: number; primary_currency: string } | null>(null)
  const [showShare, setShowShare] = useState(false)
  const [showSplit, setShowSplit] = useState(false)
  const [splitPrefill, setSplitPrefill] = useState<PendingCircleSplit | null>(null)
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

    type MemberRow = {
      user_id: string
      display_name: string | null
      role?: string | null
      profiles: { name: string | null } | { name: string | null }[] | null
    }

    let membersData: MemberRow[] = []
    let membersError: { message: string } | null = null

    {
      const first = await supabase
        .from('circle_members')
        .select('user_id, display_name, role, profiles(name)')
        .eq('circle_id', circleId)
      if (first.error && /role/i.test(first.error.message)) {
        const retry = await supabase
          .from('circle_members')
          .select('user_id, display_name, profiles(name)')
          .eq('circle_id', circleId)
        membersData = (retry.data || []) as MemberRow[]
        membersError = retry.error
      } else {
        membersData = (first.data || []) as MemberRow[]
        membersError = first.error
      }
    }

    const [circleRes, momentsRes, profileRes] = await Promise.all([
      supabase.from('circles').select('id, name, invite_code').eq('id', circleId).single(),
      supabase.from('circle_moments').select('*').eq('circle_id', circleId).order('created_at', { ascending: true }),
      supabase.from('profiles').select('name, daily_login_streak, primary_currency').eq('id', user.id).single(),
    ])

    console.log('circle_members query result:', membersData, membersError)

    if (circleRes.data) setCircle(circleRes.data)
    const loadedMoments = (momentsRes.data || []) as CircleMoment[]
    setMoments(loadedMoments)

    const mappedMembers: CircleMemberWithProfile[] = membersData.map((row) => {
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

  // After join (or return to this circle), refetch members so the count updates
  useEffect(() => {
    if (searchParams.get('joined') === '1') {
      void load().then(() => {
        router.replace(`/circles/${circleId}`, { scroll: false })
      })
    }
  }, [searchParams, circleId, load, router])

  // Refetch when tab becomes visible again (e.g. second user just joined)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  // Prefill split sheet when arriving from Log Expense → Split with circle
  useEffect(() => {
    if (loading || openedSplitRef.current) return
    const open = searchParams.get('openSplit') === '1'
    const draft = parsePendingSplitFromSearch(searchParams)
    if (!open && !draft) return
    if (!draft) return
    openedSplitRef.current = true
    setSplitPrefill(draft)
    setShowSplit(true)
    clearPendingCircleSplit()
    router.replace(`/circles/${circleId}`, { scroll: false })
  }, [loading, searchParams, circleId, router])

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
        <div className={`circles-moment circles-moment-split ${isMe ? 'circles-moment-split-mine' : 'circles-moment-theirs'}`}>
          <div className="flex items-start gap-2 mb-1">
            <span className="text-lg shrink-0">🍽️</span>
            <div>
              <p className={`circles-moment-letter ${isMe ? 'text-ink-on-indigo' : 'text-indigo'}`}>
                {senderName} added {content.description}
              </p>
              <p className={`font-fraunces text-xl font-light mt-1 ${isMe ? 'text-gold' : 'text-indigo'}`}>
                {formatCurrency(content.total_amount, content.currency)}
              </p>
              <p className={`text-xs mt-0.5 ${isMe ? 'text-ink-on-indigo/55' : 'text-ink-3'}`}>
                Split {content.split_count} ways
              </p>
              {isParticipant && (
                <p className={`text-xs mt-1.5 font-semibold ${isMe ? 'text-ink-on-indigo/90' : 'text-indigo'}`}>
                  Your share: {formatCurrency(myShare, content.currency)}
                </p>
              )}
            </div>
          </div>

          {isParticipant && (
            claimed ? (
              <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${isMe ? 'text-gold' : 'text-safe'}`}>
                <span>✓</span> Added to your expenses
              </p>
            ) : (
              <button
                type="button"
                onClick={() => handleClaimFromFeed(moment.id)}
                disabled={claimingId === moment.id}
                className={`mt-2 w-full py-2 rounded-xl text-xs font-semibold disabled:opacity-50 ${
                  isMe
                    ? 'bg-white/12 text-ink-on-indigo border border-white/20'
                    : 'bg-indigo/5 text-indigo border border-indigo/10'
                }`}
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
                  className={`circles-reaction ${
                    count > 0
                      ? 'bg-gold/15 text-indigo'
                      : isMe ? 'bg-white/10 text-ink-on-indigo/70' : 'bg-indigo/5 text-ink-3'
                  }`}
                >
                  {emoji}{count > 0 ? ` ${count}` : ''}
                </button>
              )
            })}
          </div>
          <p className={`text-xs mt-1.5 ${isMe ? 'text-ink-on-indigo/40' : 'text-ink-3'}`}>
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
        <div className={`circles-moment ${isMe ? 'circles-moment-mine' : 'circles-moment-theirs'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{emojis[moment.type] || '💰'}</span>
            <p className={`circles-moment-letter ${isMe ? 'text-ink-on-indigo' : 'text-indigo'}`}>
              {content.message}
            </p>
          </div>
          {content.streak != null && (
            <p className={`text-xs mt-0.5 ${isMe ? 'text-ink-on-indigo/55' : 'text-ink-3'}`}>
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
                  className={`circles-reaction ${
                    count > 0
                      ? 'bg-gold/15 text-indigo'
                      : isMe ? 'bg-white/10 text-ink-on-indigo/70' : 'bg-indigo/5 text-ink-3'
                  }`}
                >
                  {emoji}{count > 0 ? ` ${count}` : ''}
                </button>
              )
            })}
          </div>
          <p className={`text-xs mt-1.5 ${isMe ? 'text-ink-on-indigo/40' : 'text-ink-3'}`}>
            {new Date(moment.created_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    )
  }

  if (loading) return (
    <div className="circles-page flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="circles-page flex flex-col">
      <div className="circles-header-zone circles-enter-1">
        <div className="circles-header-inner !pt-12 !pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => router.push('/circles')}
                className="text-ink-on-indigo/60 text-xl shrink-0"
              >
                ←
              </button>
              <div className="min-w-0">
                <h1 className="font-fraunces text-xl font-semibold text-ink-on-indigo truncate">{circle?.name}</h1>
                <p className="circles-subtitle !text-xs !mt-0.5">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button type="button" onClick={copyInviteCode} className="circles-code-pill shrink-0">
              {copied ? 'Copied ✓' : circle?.invite_code}
            </button>
          </div>
        </div>
      </div>

      <div className="circles-feed-zone circles-enter-2">
        {moments.length === 0 ? (
          <div className="circles-empty">
            <p className="circles-empty-icon">🌸</p>
            <p className="font-fraunces text-lg font-medium text-indigo mb-1">Nothing shared yet</p>
            <p className="text-ink-3 text-sm leading-relaxed max-w-xs mx-auto">
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

      <div className="circles-action-bar">
        <button
          type="button"
          onClick={() => setShowSplit(true)}
          disabled={members.length < 2}
          title={
            members.length < 2
              ? 'Invite someone with the code above — splits need 2+ members'
              : undefined
          }
          className="circles-btn-indigo-outline !py-3.5 !text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Split an expense 🍽️
        </button>
        <button type="button" onClick={() => setShowShare(true)} className="circles-btn-coral">
          Share a moment 🌸
        </button>
      </div>

      {showSplit && (
        <SplitExpenseSheet
          key={splitPrefill ? `prefill-${splitPrefill.amount}-${splitPrefill.description}` : 'manual'}
          circleId={circleId}
          members={members}
          currentUserId={userId}
          currency={currency}
          initialAmount={splitPrefill ? String(splitPrefill.amount) : ''}
          initialDescription={splitPrefill?.description || ''}
          initialCategory={splitPrefill?.category || 'Social'}
          onClose={() => {
            setShowSplit(false)
            setSplitPrefill(null)
          }}
          onComplete={load}
        />
      )}

      {showShare && (
        <>
          <div className="circles-overlay" onClick={() => setShowShare(false)} />
          <div className="circles-sheet circles-enter-1">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-fraunces text-xl font-semibold text-indigo">Share a moment</h3>
              <button type="button" onClick={() => setShowShare(false)} className="text-ink-3 text-2xl leading-none">×</button>
            </div>
            <div className="circles-notice mb-5">
              <p className="text-sm text-indigo leading-relaxed">
                These moments stay amount-free — only splits show totals to the circle.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {MOMENT_TYPES.map(m => (
                <button
                  key={m.type}
                  type="button"
                  onClick={() => handleShare(m.type)}
                  disabled={sharing}
                  className="circles-share-option disabled:opacity-50"
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <p className="font-medium text-indigo text-sm">{m.label}</p>
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
