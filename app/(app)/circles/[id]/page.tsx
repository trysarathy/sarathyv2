'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import TabBar from '@/components/ui/TabBar'

interface Moment {
  id: string
  type: string
  content: any
  reactions: string[]
  sender_id: string
  created_at: string
}

const REACTIONS = ['🎉', '💪', '😮', '❤️', '🌸']

const MOMENT_TYPES = [
  { type: 'streak', label: 'Share my streak', emoji: '🔥' },
  { type: 'checkin', label: 'Weekly check-in', emoji: '✅' },
  { type: 'goal', label: 'Goal progress', emoji: '🎯' },
  { type: 'win', label: 'Share a win', emoji: '🏆' },
]

export default function CirclePage() {
  const router = useRouter()
  const params = useParams()
  const circleId = params.id as string
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)

  const [circle, setCircle] = useState<any>(null)
  const [moments, setMoments] = useState<Moment[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const [showShare, setShowShare] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    setUserId(user.id)

    const [circleRes, momentsRes, membersRes, profileRes] = await Promise.all([
      supabase.from('circles').select('*').eq('id', circleId).single(),
      supabase.from('circle_moments').select('*').eq('circle_id', circleId).order('created_at', { ascending: true }),
      supabase.from('circle_members').select('*').eq('circle_id', circleId),
      supabase.from('profiles').select('name, daily_login_streak, total_xp').eq('id', user.id).single(),
    ])

    if (circleRes.data) setCircle(circleRes.data)
    setMoments((momentsRes.data || []) as Moment[])
    setMembers(membersRes.data || [])
    if (profileRes.data) setProfile(profileRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [circleId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [moments])

  const handleShare = async (type: string) => {
    setSharing(true)
    try {
      let content: any = {}
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

  const copyInviteCode = () => {
    if (circle?.invite_code) {
      navigator.clipboard.writeText(circle.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getMomentCard = (moment: Moment) => {
    const isMe = moment.sender_id === userId
    const emojis: Record<string, string> = {
      streak: '🔥', checkin: '✅', goal: '🎯', win: '🏆'
    }
    return (
      <div key={moment.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3`}>
        <div className={`max-w-xs rounded-2xl p-3 ${isMe ? 'bg-saffron text-white' : 'bg-white shadow-sm'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{emojis[moment.type] || '💰'}</span>
            <p className={`text-sm font-medium ${isMe ? 'text-white' : 'text-ink'}`}>
              {moment.content.message}
            </p>
          </div>
          {moment.content.streak && (
            <p className={`text-xs ${isMe ? 'text-white/70' : 'text-ink-3'}`}>
              {moment.content.streak} days
            </p>
          )}
          <div className="flex gap-1 mt-2 flex-wrap">
            {REACTIONS.map(emoji => {
              const count = (moment.reactions || []).filter((r: string) => r === emoji).length
              return (
                <button
                  key={emoji}
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
      {/* Header */}
      <div className="px-5 pt-12 pb-3 bg-cream border-b border-cream-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/circles')} className="text-ink-3 text-xl">←</button>
            <div>
              <h1 className="font-fraunces text-lg font-semibold text-ink">{circle?.name}</h1>
              <p className="text-ink-3 text-xs">{members.length} member{members.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={copyInviteCode}
            className="text-xs font-medium px-3 py-1.5 rounded-xl bg-saffron-soft text-saffron">
            {copied ? 'Copied! ✓' : `Code: ${circle?.invite_code}`}
          </button>
        </div>
      </div>

      {/* Moments feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-40">
        {moments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">🌸</p>
            <p className="font-medium text-ink mb-1">Nothing shared yet</p>
            <p className="text-ink-3 text-sm">
              Share a money moment below — streaks, wins, goals.
              Amounts are always private.
            </p>
          </div>
        ) : (
          moments.map(getMomentCard)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Share button */}
      <div className="fixed bottom-16 left-0 right-0 px-5 pb-2">
        <button onClick={() => setShowShare(true)} className="btn-primary">
          Share a moment 🌸
        </button>
      </div>

      {/* Share sheet */}
      {showShare && (
        <>
          <div className="overlay" onClick={() => setShowShare(false)} />
          <div className="bottom-sheet">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-fraunces text-xl font-semibold text-ink">Share a moment</h3>
              <button onClick={() => setShowShare(false)} className="text-ink-3 text-2xl">×</button>
            </div>
            <p className="text-ink-3 text-sm mb-4">
              Amounts are never shown to others — only your progress and wins.
            </p>
            <div className="flex flex-col gap-3">
              {MOMENT_TYPES.map(m => (
                <button
                  key={m.type}
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

      <TabBar active="sarathy" />
    </div>
  )
}
