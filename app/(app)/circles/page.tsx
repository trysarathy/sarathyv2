'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import TabBar from '@/components/ui/TabBar'

interface Circle {
  id: string
  name: string
  invite_code: string
  created_by: string
  created_at: string
}

export default function CirclesPage() {
  const router = useRouter()
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

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    setUserId(user.id)

    const { data: memberRows } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('user_id', user.id)

    if (!memberRows?.length) { setLoading(false); return }

    const ids = memberRows.map(r => r.circle_id)
    const { data } = await supabase
      .from('circles')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false })

    setCircles((data || []) as Circle[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
      load()
    } catch (err: any) {
      setError(err.message || 'Could not create circle')
    } finally { setSaving(false) }
  }

  const handleJoin = async () => {
    if (!inviteCode.trim()) return
    setSaving(true); setError('')
    try {
      const { data: circle, error: e } = await supabase
        .from('circles')
        .select('*')
        .eq('invite_code', inviteCode.trim().toLowerCase())
        .single()
      if (e || !circle) throw new Error('Circle not found — check the invite code')

      const { error: memberError } = await supabase
        .from('circle_members')
        .insert({ circle_id: circle.id, user_id: userId })
      if (memberError && !memberError.message.includes('duplicate')) throw memberError

      setInviteCode(''); setShowJoin(false)
      load()
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
        {circles.length === 0 ? (
          <div className="circles-card text-center py-10">
            <p className="circles-empty-icon">👥</p>
            <p className="font-fraunces text-lg font-semibold text-indigo mb-2">
              No circles yet
            </p>
            <p className="text-ink-3 text-sm mb-6 leading-relaxed max-w-xs mx-auto">
              Create a private circle with people you trust —
              partner, roommates, family, or an accountability buddy.
              Amounts are always blurred. Only money moments are shared.
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
                onClick={() => router.push(`/circles/${circle.id}`)}
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
