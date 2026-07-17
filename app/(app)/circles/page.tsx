'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import TabBar from '@/components/ui/TabBar'
import {
  clearPendingCircleSplit,
  parsePendingSplitFromSearch,
  pendingSplitQuery,
  savePendingCircleSplit,
  type PendingCircleSplit,
} from '@/lib/circles/pending-split'
import { formatCurrency } from '@/lib/calculations'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'

interface Circle {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

function CirclesPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [circles, setCircles] = useState<Circle[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [name, setName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState('')
  const [currency, setCurrency] = useState('SGD')
  const [pendingSplit, setPendingSplit] = useState<PendingCircleSplit | null>(null)
  const routedSplitRef = useRef(false)

  const openCircleWithSplit = (circleId: string, draft: PendingCircleSplit) => {
    savePendingCircleSplit(draft)
    router.push(`/circles/${circleId}?${pendingSplitQuery(draft)}`)
  }

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    setUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('primary_currency')
      .eq('id', user.id)
      .single()
    if (profile) setCurrency(getProfileDisplayCurrency(profile))

    const draft = parsePendingSplitFromSearch(searchParams)
    if (draft) {
      setPendingSplit(draft)
      savePendingCircleSplit(draft)
    }

    const wantCreate = searchParams.get('create') === '1'

    const { data: memberRows } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('user_id', user.id)

    if (!memberRows?.length) {
      setCircles([])
      setLoading(false)
      if (draft || wantCreate) {
        setShowCreate(true)
        setError('')
      }
      return
    }

    const ids = memberRows.map(r => r.circle_id)
    const { data } = await supabase
      .from('circles')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false })

    const list = (data || []) as Circle[]
    setCircles(list)
    setLoading(false)

    // Auto-open the only circle when coming from log-expense split
    if (draft && list.length === 1 && !routedSplitRef.current) {
      routedSplitRef.current = true
      openCircleWithSplit(list[0].id, draft)
    }
  }

  useEffect(() => { void load() }, [])

  const handleCreate = async () => {
    if (!name.trim()) return
    setSaving(true); setError('')
    try {
      const { data: circle, error: e } = await supabase
        .from('circles')
        .insert({ name: name.trim(), created_by: userId })
        .select()
        .single()
      if (e) throw e

      await supabase.from('circle_members').insert({
        circle_id: circle.id,
        user_id: userId,
        display_name: 'You',
      })

      setName(''); setShowCreate(false)
      if (pendingSplit) {
        openCircleWithSplit(circle.id, pendingSplit)
        return
      }
      void load()
    } catch (err: any) {
      setError(err.message || 'Could not create circle')
    } finally { setSaving(false) }
  }

  const handleJoin = async () => {
    if (!inviteCode.trim()) return
    setSaving(true); setError('')
    try {
      const normalizedCode = inviteCode.trim().toLowerCase()
      console.log('Searching for invite code:', normalizedCode)

      const { data, error } = await supabase
        .from('circles')
        .select('*')
        .eq('invite_code', normalizedCode)
        .single()

      console.log('Circle query result:', data, error)

      if (error || !data) throw new Error('Circle not found — check the invite code')

      const { error: memberError } = await supabase
        .from('circle_members')
        .insert({ circle_id: data.id, user_id: userId })
      if (memberError && !memberError.message.includes('duplicate')) throw memberError

      setInviteCode(''); setShowJoin(false)
      if (pendingSplit) {
        openCircleWithSplit(data.id, pendingSplit)
        return
      }
      void load()
    } catch (err: any) {
      setError(err.message || 'Could not join circle')
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div className="circles-page flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="circles-page pb-24">
      <div className="circles-header-zone circles-enter-1">
        <div className="circles-header-inner">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="circles-kicker mb-1">Community</p>
              <h1 className="circles-title">Circles</h1>
              <p className="circles-subtitle">Your private money community</p>
            </div>
            <div className="flex gap-2 shrink-0 pt-1">
              <button
                type="button"
                onClick={() => { setShowJoin(true); setShowCreate(false); setError('') }}
                className="circles-btn-ghost"
              >
                Join
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(true); setShowJoin(false); setError('') }}
                className="circles-btn-ghost"
              >
                + Create
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-1 circles-enter-2">
        {pendingSplit && circles.length > 1 && (
          <div className="circles-notice mb-4">
            <p className="text-sm font-medium text-indigo mb-1">
              Split {formatCurrency(pendingSplit.amount, currency)}
            </p>
            <p className="text-xs text-ink-3 leading-relaxed">
              Tap a circle below to share
              {pendingSplit.description ? ` “${pendingSplit.description}”` : ' this expense'}.
            </p>
            <button
              type="button"
              className="text-xs text-ink-3 underline mt-2"
              onClick={() => {
                clearPendingCircleSplit()
                setPendingSplit(null)
                router.replace('/circles')
              }}
            >
              Cancel split
            </button>
          </div>
        )}

        {circles.length === 0 ? (
          <div className="circles-card text-center py-10">
            <p className="circles-empty-icon">👥</p>
            <p className="font-fraunces text-lg font-semibold text-indigo mb-2">
              {pendingSplit ? 'Create a circle to split this' : 'No circles yet'}
            </p>
            <p className="text-ink-3 text-sm mb-6 leading-relaxed max-w-xs mx-auto">
              {pendingSplit
                ? `Create or join a circle to split ${formatCurrency(pendingSplit.amount, currency)}${
                    pendingSplit.description ? ` for “${pendingSplit.description}”` : ''
                  }.`
                : 'Create a private circle with people you trust — partner, roommates, family, or an accountability buddy. Amounts are always blurred. Only money moments are shared.'}
            </p>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => setShowCreate(true)} className="circles-btn-coral">
                Create a circle
              </button>
              <button type="button" onClick={() => setShowJoin(true)} className="circles-btn-indigo-outline">
                Join with code
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {circles.map(circle => (
              <button
                key={circle.id}
                type="button"
                onClick={() => {
                  if (pendingSplit) openCircleWithSplit(circle.id, pendingSplit)
                  else router.push(`/circles/${circle.id}`)
                }}
                className="circles-card flex items-center justify-between active:opacity-80 text-left w-full transition-opacity"
              >
                <div className="flex items-center gap-3">
                  <div className="circles-card-icon">👥</div>
                  <div>
                    <p className="font-semibold text-indigo text-sm">{circle.name}</p>
                    <p className="text-ink-3 text-xs mt-0.5">
                      Code{' '}
                      <span className="font-mono font-semibold text-gold">{circle.invite_code}</span>
                    </p>
                  </div>
                </div>
                <span className="text-indigo/30 text-lg">→</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <>
          <div className="circles-overlay" onClick={() => setShowCreate(false)} />
          <div className="circles-sheet circles-enter-1">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-fraunces text-xl font-semibold text-indigo">Create a circle</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="text-ink-3 text-2xl leading-none">×</button>
            </div>
            <p className="text-ink-3 text-sm mb-4 leading-relaxed">
              Give it a name. You&apos;ll get an invite code to share with people you trust.
            </p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Roommates, Partner, Family"
              className="circles-input mb-4"
              autoFocus
            />
            {error && <div className="bg-red-50 text-danger text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}
            <button type="button" onClick={handleCreate} className="circles-btn-indigo" disabled={saving || !name.trim()}>
              {saving ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Create circle →'}
            </button>
          </div>
        </>
      )}

      {showJoin && (
        <>
          <div className="circles-overlay" onClick={() => setShowJoin(false)} />
          <div className="circles-sheet circles-enter-1">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-fraunces text-xl font-semibold text-indigo">Join a circle</h3>
              <button type="button" onClick={() => setShowJoin(false)} className="text-ink-3 text-2xl leading-none">×</button>
            </div>
            <p className="text-ink-3 text-sm mb-4 leading-relaxed">
              Enter the 8-character invite code someone shared with you.
            </p>
            <input
              type="text"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              placeholder="e.g. a1b2c3d4"
              className="circles-input mb-4 font-mono text-center text-lg tracking-widest"
              autoFocus
              maxLength={8}
            />
            {error && <div className="bg-red-50 text-danger text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}
            <button type="button" onClick={handleJoin} className="circles-btn-indigo" disabled={saving || !inviteCode.trim()}>
              {saving ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Join circle →'}
            </button>
          </div>
        </>
      )}

      <TabBar active="circles" />
    </div>
  )
}

export default function CirclesPage() {
  return (
    <Suspense
      fallback={
        <div className="circles-page flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CirclesPageInner />
    </Suspense>
  )
}
