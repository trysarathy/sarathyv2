'use client'

import Link from 'next/link'

interface ExploreTile {
  emoji: string
  label: string
  href?: string
  onClick?: () => void
}

interface Props {
  onOpenMonth: () => void
}

const TILES: ExploreTile[] = [
  { emoji: '🤔', label: 'Money check', href: '/check' },
  { emoji: '🧠', label: 'Psychology', href: '/biases' },
  { emoji: '🔮', label: 'Future you', href: '/future' },
  { emoji: '🧬', label: 'Financial DNA', href: '/insights' },
  { emoji: '📊', label: 'My data', href: '/mydata' },
  { emoji: '💸', label: 'Send home', href: '/remittance' },
  { emoji: '📋', label: 'This month' },
  { emoji: '📄', label: 'Import', href: '/upload' },
  { emoji: '💳', label: 'Fixed costs', href: '/fixed' },
  { emoji: '🏪', label: 'Built for you', href: '/marketplace' },
]

export default function ExploreGrid({ onOpenMonth }: Props) {
  return (
    <div className="px-5 mb-6">
      <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-3">
        Explore
      </p>
      <div className="grid grid-cols-2 gap-2">
        {TILES.map((tile) => {
          const className =
            'bg-white rounded-xl p-3 shadow-sm flex items-center gap-2 active:scale-[0.98] transition-transform text-left min-h-[52px]'

          if (tile.label === 'This month') {
            return (
              <button
                key={tile.label}
                type="button"
                onClick={onOpenMonth}
                className={className}
              >
                <span className="text-lg">{tile.emoji}</span>
                <span className="text-sm font-medium text-ink">{tile.label}</span>
              </button>
            )
          }

          return (
            <Link key={tile.label} href={tile.href!} className={className}>
              <span className="text-lg">{tile.emoji}</span>
              <span className="text-sm font-medium text-ink">{tile.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
