'use client'

import { Suspense, useState } from 'react'
import WiseCard from '@/components/home/WiseCard'
import FinverseCard from '@/components/home/FinverseCard'
import type { Profile, BudgetEntry } from '@/types'

interface Props {
  profile: Profile
  existingEntries: BudgetEntry[]
  onSynced: () => void
}

function StripContent({ profile, existingEntries, onSynced }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="home-accounts-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between mb-2 text-left"
      >
        <span className="text-sm font-medium text-[#1C0F3F]/80 tracking-wide">
          Connected accounts
        </span>
        <span className="text-[#A09080] text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      <div className="flex flex-col gap-2">
        <WiseCard
          profile={profile}
          existingEntries={existingEntries}
          onSynced={onSynced}
          variant="compact"
          showDetails={expanded}
        />
        <FinverseCard
          profile={profile}
          existingEntries={existingEntries}
          onSynced={onSynced}
          variant="compact"
          showDetails={expanded}
        />
      </div>
    </div>
  )
}

export default function ConnectedAccountsStrip(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="home-accounts-card flex items-center gap-2 py-3">
          <div className="w-4 h-4 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-indigo-muted">Loading accounts…</p>
        </div>
      }
    >
      <StripContent {...props} />
    </Suspense>
  )
}
