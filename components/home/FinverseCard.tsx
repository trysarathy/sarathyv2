'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/api-auth'
import type { FinancialBalance, FinancialTransaction } from '@/lib/financial/types'
import type { Profile, BudgetEntry } from '@/types'
import { syncExpensesToBudget, formatSyncError } from '@/lib/financial/import-expenses'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import {
  friendlyBankLoadError,
  friendlyFinverseLinkError,
} from '@/lib/booth/friendly-errors'

interface Props {
  profile: Profile
  existingEntries: BudgetEntry[]
  onSynced: () => void
  variant?: 'full' | 'compact'
  showDetails?: boolean
}

function formatBalance(amount: number, currency: string): string {
  if (currency === 'SGD') {
    return `S$${amount.toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }
  if (currency === 'INR') {
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  }
  return `${currency} ${amount.toFixed(0)}`
}

function primaryBalance(balances: FinancialBalance[], profileCurrency: string): string | null {
  if (balances.length === 0) return null
  const match = balances.find((b) => b.currency === profileCurrency) ?? balances[0]
  return formatBalance(match.amount, match.currency)
}

export default function FinverseCard({
  profile,
  existingEntries,
  onSynced,
  variant = 'full',
  showDetails = false,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const profileCurrency = getProfileDisplayCurrency(profile)

  const [connected, setConnected] = useState(false)
  const [institutionName, setInstitutionName] = useState<string | null>(null)
  const [balances, setBalances] = useState<FinancialBalance[]>([])
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [linkBanner, setLinkBanner] = useState('')

  const loadSyncData = useCallback(async () => {
    const res = await fetch('/api/finverse/sync?days=30', { headers: await getAuthHeaders() })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Could not load bank data')
    }
    setInstitutionName(data.institutionName ?? null)
    setBalances(data.balances ?? [])
    setTransactions(data.transactions ?? [])
  }, [])

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/finverse/status', { headers: await getAuthHeaders() })
      const data = await res.json()
      if (!res.ok) {
        setError(friendlyBankLoadError())
        setConnected(false)
        return
      }

      setConnected(Boolean(data.connected))
      setInstitutionName(data.institutionName ?? null)

      if (data.connected) {
        await loadSyncData()
      } else {
        setBalances([])
        setTransactions([])
      }
    } catch {
      setError(friendlyBankLoadError())
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [loadSyncData])

  useEffect(() => { loadStatus() }, [loadStatus])

  useEffect(() => {
    const finverse = searchParams.get('finverse')
    if (finverse === 'connected') {
      setLinkBanner('Bank connected successfully')
      loadStatus()
      router.replace('/home', { scroll: false })
    } else if (finverse === 'error') {
      const reason = searchParams.get('reason')
      setLinkBanner('')
      setError(friendlyFinverseLinkError(reason))
      router.replace('/home', { scroll: false })
    }
  }, [searchParams, loadStatus, router])

  const handleConnect = async () => {
    setConnecting(true)
    setError('')
    setLinkBanner('')
    try {
      const res = await fetch('/api/finverse/link', { headers: await getAuthHeaders() })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(friendlyFinverseLinkError())
        setConnecting(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError(friendlyFinverseLinkError())
      setConnecting(false)
    }
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
        loggedVia: 'finverse',
      })

      setSyncMessage(result.message)
      if (result.imported > 0) onSynced()
    } catch (err: unknown) {
      setError(formatSyncError(err))
    } finally {
      setSyncing(false)
    }
  }

  const bankLabel = loading
    ? '…'
    : connected
      ? `${institutionName ?? 'Bank'} · ${primaryBalance(balances, profileCurrency) ?? '—'}`
      : 'Not connected'

  if (variant === 'compact') {
    return (
      <div className="border-t border-indigo/8 pt-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            <span>🏦</span>
            <span className="font-medium text-ink shrink-0">Bank</span>
            <span className="text-ink-3 truncate">{bankLabel}</span>
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
              disabled={connecting || loading}
              className="text-xs font-semibold home-sync-btn disabled:opacity-40 shrink-0"
            >
              {connecting ? '…' : 'Connect'}
            </button>
          )}
        </div>

        {error && !showDetails && (
          <p className="text-[10px] text-danger mt-1 leading-snug">{error}</p>
        )}

        {showDetails && (
          <div className="mt-3 pt-2 border-t border-indigo/8">
            {linkBanner && <p className="text-xs text-safe mb-2">{linkBanner}</p>}
            {error && <p className="text-xs text-danger mb-2">{error}</p>}
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
            {syncMessage && <p className="text-xs text-safe mb-2">{syncMessage}</p>}
            {!connected && (
              <p className="text-[11px] text-ink-3">
                Link your bank to import balances and transactions.
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card border-l-4 border-indigo-500">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏦</span>
          <div>
            <p className="font-medium text-ink text-sm">Bank account</p>
            <p className="text-ink-3 text-xs">
              {connected && institutionName ? institutionName : 'Link via Finverse'}
            </p>
          </div>
        </div>
      </div>

      {linkBanner && (
        <div className="bg-green-50 text-safe text-sm px-3 py-2 rounded-xl mb-3">{linkBanner}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <div className="w-5 h-5 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-3">Loading…</p>
        </div>
      ) : !connected ? (
        <>
          {error && (
            <div className="bg-red-50 text-danger text-sm px-3 py-2 rounded-xl mb-3">{error}</div>
          )}
          <p className="text-sm text-ink-3 mb-4">
            Connect your bank to import balances and transactions into Sarathy.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="btn-primary w-full"
          >
            {connecting ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Connect bank'
            )}
          </button>
        </>
      ) : (
        <>
          {error && !balances.length ? (
            <p className="text-sm text-danger mb-3">{error}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {balances.length === 0 ? (
                <p className="text-sm text-ink-3 col-span-2">No balances available yet</p>
              ) : (
                balances.map((b) => (
                  <div key={b.currency} className="bg-cream rounded-xl p-3">
                    <p className="text-xs text-ink-3 mb-0.5">{b.currency}</p>
                    <p className="font-fraunces text-lg font-semibold text-ink">
                      {formatBalance(b.amount, b.currency)}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

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
            disabled={syncing || !transactions.length}
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
