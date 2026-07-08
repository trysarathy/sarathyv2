'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/api-auth'
import type { WiseBalance, WiseTransaction, WiseMode } from '@/lib/wise/types'
import type { Profile, BudgetEntry } from '@/types'
import { syncExpensesToBudget, formatSyncError } from '@/lib/wise/import-transactions'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'

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

  const [mode, setMode] = useState<WiseMode>('mock')
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
        setError(data.error || 'Could not load Wise data')
        return
      }
      setMode(data.mode ?? 'mock')
      setBalances(data.balances ?? [])
      setTransactions(data.transactions ?? [])
    } catch {
      setError('Could not connect to Wise')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchWise() }, [fetchWise])

  const handleSync = async () => {
    if (!transactions.length) return
    setSyncing(true)
    setError('')
    setSyncMessage('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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

  const balanceLabel = loading
    ? '…'
    : primaryBalance(balances, profileCurrency) ?? (error ? '—' : '—')

  if (variant === 'compact') {
    return (
      <div className="border-t border-indigo/8 first:border-0 pt-2 first:pt-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            <span>💚</span>
            <span className="font-medium text-ink shrink-0">Wise</span>
            <span className="text-ink-3 truncate">{balanceLabel}</span>
            {mode === 'mock' && !loading && (
              <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                Demo
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || loading || !transactions.length}
            className="text-xs font-semibold home-sync-btn disabled:opacity-40 shrink-0"
          >
            {syncing ? '…' : 'Sync'}
          </button>
        </div>

        {showDetails && (
          <div className="mt-3 pt-2 border-t border-indigo/8">
            {error && !balances.length && (
              <p className="text-xs text-danger mb-2">{error}</p>
            )}
            {balances.length > 0 && (
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
            {transactions.length > 0 && (
              <p className="text-[11px] text-ink-3 mb-2">
                {transactions.length} ready to import
              </p>
            )}
            {syncMessage && (
              <p className="text-xs text-safe mb-2">{syncMessage}</p>
            )}
            {error && balances.length > 0 && (
              <p className="text-xs text-danger mb-2">{error}</p>
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
            <p className="text-ink-3 text-xs">Multi-currency balances</p>
          </div>
        </div>
        {mode === 'mock' && (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full bg-amber-100 text-amber-800">
            Demo data
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <div className="w-5 h-5 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-3">Loading balances…</p>
        </div>
      ) : error && !balances.length ? (
        <p className="text-sm text-danger mb-3">{error}</p>
      ) : (
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
      )}

      {transactions.length > 0 && !loading && (
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
    </div>
  )
}
