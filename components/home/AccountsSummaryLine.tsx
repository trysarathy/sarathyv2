'use client'

import { useEffect, useState } from 'react'
import { getAuthHeaders } from '@/lib/api-auth'
import type { FinancialBalance } from '@/lib/financial/types'
import type { Profile } from '@/types'
import { buildAccountsSummary, mergeBalances } from '@/lib/home/format-accounts-summary'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'

interface Props {
  profile: Profile
}

export default function AccountsSummaryLine({ profile }: Props) {
  const [summary, setSummary] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const primary = getProfileDisplayCurrency(profile)
      const secondary = profile.secondary_currency
      const balanceLists: FinancialBalance[][] = []

      try {
        const wiseRes = await fetch('/api/wise/sync?days=30', {
          headers: await getAuthHeaders(),
        })
        if (wiseRes.ok) {
          const wiseData = await wiseRes.json()
          if (Array.isArray(wiseData.balances)) {
            balanceLists.push(wiseData.balances)
          }
        }
      } catch {
        // Wise optional — continue with Finverse
      }

      try {
        const statusRes = await fetch('/api/finverse/status', {
          headers: await getAuthHeaders(),
        })
        if (statusRes.ok) {
          const statusData = await statusRes.json()
          if (statusData.connected) {
            const syncRes = await fetch('/api/finverse/sync?days=30', {
              headers: await getAuthHeaders(),
            })
            if (syncRes.ok) {
              const syncData = await syncRes.json()
              if (Array.isArray(syncData.balances)) {
                balanceLists.push(syncData.balances)
              }
            }
          }
        }
      } catch {
        // Finverse optional
      }

      if (cancelled) return
      const merged = mergeBalances(balanceLists)
      setSummary(buildAccountsSummary(primary, secondary, merged))
    }

    load()
    return () => {
      cancelled = true
    }
  }, [profile.primary_currency, profile.secondary_currency])

  if (!summary) return null

  return (
    <p className="text-[13px] text-ink-on-indigo/75 font-jakarta tracking-wide mt-2">
      {summary}
    </p>
  )
}
