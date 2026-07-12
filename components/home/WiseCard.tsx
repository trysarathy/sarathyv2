'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/api-auth'
import type { WiseBalance, WiseTransaction } from '@/lib/wise/types'
import type { Profile, BudgetEntry } from '@/types'
import { syncExpensesToBudget, formatSyncError } from '@/lib/wise/import-transactions'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import { friendlyWiseLoadError } from '@/lib/booth/friendly-errors'

interface Props {
  profile: Profile
  existingEntries: BudgetEntry[]
  onSynced: () => void
  variant?: 'full' | 'compact'
  showDetails?: boolean
}

function formatBalance(amount: number, currency: string): string {
  if (currency === 'SGD') return `S$${amount.toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  if (currency === 'INR') return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  return `${currency} ${amount.toFixed(0)}`
}

function primaryBalance(balances: WiseBalance[], profileCurrency: string): string | null {
  if (balances.length === 0) return null
  const match = balances.find((b) => b.currency === profileCurrency) ?? balances[0]
  return formatBalance(match.amount, match.currency)
}

export default function WiseCard({
  profile,
  existingEntries,
  onSynced,
  variant = 'full',
  showDetails = false,
}: Props) {
  const supabase = createClient()
  const profileCurrency = getProfileDisplayCurrency(profile)

  const [connected, setConnected] = useState(false)
  const [balances, setBalances] = useState<WiseBalance[]>([])
  const [transactions, setTransactions] = useState<WiseTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [syncMessage, setSyncMessage] = useState('')

  const fetchWise = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/wise/sync?days=30', { headers: await getAuthHeaders() })
      const data = await res.json()
      if (!res.ok) {
        setError(friendlyWiseLoadError())
        setConnected(false)
        setBalances([])
        setTransactions([])
        return
      }
      const isConnected = Boolean(data.connected) && data.mode === 'real'
      setConnected(isConnected)
      setBalances(isConnected ? (data.balances ?? []) : [])
      setTransactions(isConnected ? (data.transactions ?? []) : [])
    } catch {
      setError(friendlyWiseLoadError())
      setConnected(false)
      setBalances([])
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchWise() }, [fetchWise])

  const handleConnect = () => {
    setError('Wise linking isn’t available yet.')
  }

  const handleSync = async () => {
    if (!transactions.length) return
    setSyncing(true)
    setError('')
    setSyncMessage('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Sign in again to sync transactions.')
        return
      }

      const result = await syncExpensesToBudget({
        supabase,
        userId: user.id,
        profileCurrency,
        transactions,
        existingEntries,
        loggedVia: 'wise',
      })

      setSyncMessage(result.message)
      if (result.imported > 0) onSynced()
    } catch (err: unknown) {
      setError(formatSyncError(err))
    } finally {
      setSyncing(false)
    }
  }

  const statusLabel = loading
    ? '…'
    : connected
      ? (primaryBalance(balances, profileCurrency) ?? '—')
      : 'Not connected'

  if (variant === 'compact') {
    return (
      <div className="border-t border-indigo/8 first:border-0 pt-2 first:pt-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            <span>💚</span>
            <span className="font-medium text-ink shrink-0">Wise</span>
            <span className={`truncate ${connected ? 'text-ink-3' : 'text-[#A09080]'}`}>
              {statusLabel}
            </span>
          </div>
          {connected ? (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing || loading || !transactions.length}
              className="text-xs font-semibold home-sync-btn disabled:opacity-40 shrink-0"
            >
              {syncing ? '…' : 'Sync'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={loading}
              className="text-xs font-semibold home-sync-btn disabled:opacity-40 shrink-0"
            >
              Connect →
            </button>
          )}
        </div>

        {error && !showDetails && (
          <p className="text-[10px] text-danger mt-1 leading-snug">{error}</p>
        )}

        {showDetails && (
          <div className="mt-3 pt-2 border-t border-indigo/8">
            {error && (
              <p className="text-xs text-danger mb-2">{error}</p>
            )}
            {connected && balances.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                {balances.map((b) => (
                  <div key={b.currency} className="bg-cream rounded-lg p-2">
                    <p className="text-[10px] text-ink-3">{b.currency}</p>
                    <p className="font-fraunces text-sm font-semibold text-ink">
                      {formatBalance(b.amount, b.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {connected && transactions.length > 0 && (
              <p className="text-[11px] text-ink-3 mb-2">
                {transactions.length} ready to import
              </p>
            )}
            {syncMessage && (
              <p className="text-xs text-safe mb-2">{syncMessage}</p>
            )}
            {!connected && !error && (
              <p className="text-[11px] text-ink-3">
                Connect Wise to import multi-currency balances and expenses.
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card border-l-4 border-green-500">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">💚</span>
          <div>
            <p className="font-medium text-ink text-sm">Wise</p>
            <p className="text-ink-3 text-xs">
              {connected ? 'Multi-currency balances' : 'Not connected'}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <div className="w-5 h-5 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-3">Loading…</p>
        </div>
      ) : !connected ? (
        <>
          {error && <p className="text-sm text-danger mb-3">{error}</p>}
          <p className="text-sm text-ink-3 mb-3">
            Connect Wise to import balances and expenses.
          </p>
          <button type="button" onClick={handleConnect} className="btn-primary w-full">
            Connect →
          </button>
        </>
      ) : error && !balances.length ? (
        <p className="text-sm text-danger mb-3">{error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {balances.map((b) => (
              <div key={b.currency} className="bg-cream rounded-xl p-3">
                <p className="text-xs text-ink-3 mb-0.5">{b.currency}</p>
                <p className="font-fraunces text-lg font-semibold text-ink">
                  {formatBalance(b.amount, b.currency)}
                </p>
              </div>
            ))}
          </div>

          {transactions.length > 0 && (
            <p className="text-xs text-ink-3 mb-3">
              {transactions.length} expense{transactions.length === 1 ? '' : 's'} ready to import (last 30 days)
            </p>
          )}

          {syncMessage && (
            <div className="bg-green-50 text-safe text-sm px-3 py-2 rounded-xl mb-3">{syncMessage}</div>
          )}
          {error && balances.length > 0 && (
            <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-xl mb-3">{error}</div>
          )}

          <button
            onClick={handleSync}
            disabled={syncing || loading || !transactions.length}
            className="btn-primary w-full"
          >
            {syncing ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Sync transactions'
            )}
          </button>
        </>
      )}
    </div>
  )
}
