'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/api-auth'
import type { WiseBalance, WiseTransaction, WiseMode } from '@/lib/wise/types'
import type { Profile, BudgetEntry } from '@/types'
import { syncExpensesToBudget, formatSyncError } from '@/lib/financial/import-expenses'

interface Props {
  profile: Profile
  existingEntries: BudgetEntry[]
  onSynced: () => void
}

function formatBalance(amount: number, currency: string): string {
  if (currency === 'SGD') return `S$${amount.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (currency === 'INR') return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  return `${currency} ${amount.toFixed(2)}`
}

export default function WiseCard({ profile, existingEntries, onSynced }: Props) {
  const supabase = createClient()
  const profileCurrency = profile.primary_currency || 'SGD'

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
          {balances.map(b => (
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
