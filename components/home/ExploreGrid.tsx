'use client'

import Link from 'next/link'

interface ExploreTile {
  emoji: string
  label: string
  href?: string
  tint: string
}

interface Props {
  onOpenMonth: () => void
}

const TILES: ExploreTile[] = [
  { emoji: '🤔', label: 'Money check', href: '/check', tint: 'bg-indigo/[0.04]' },
  { emoji: '🧠', label: 'Psychology', href: '/biases', tint: 'bg-indigo/[0.04]' },
  { emoji: '🔮', label: 'Future you', href: '/future', tint: 'bg-[#FEF7ED]' },
  { emoji: '🧬', label: 'Financial DNA', href: '/insights', tint: 'bg-[#FEF7ED]' },
  { emoji: '📊', label: 'My data', href: '/mydata', tint: 'bg-[#FEF7ED]' },
  { emoji: '💸', label: 'Send home', href: '/remittance', tint: 'bg-gold/[0.08]' },
  { emoji: '📋', label: 'This month', tint: 'bg-gold/[0.08]' },
  { emoji: '📄', label: 'Import', href: '/upload', tint: 'bg-white' },
  { emoji: '💳', label: 'Fixed costs', href: '/fixed', tint: 'bg-white' },
  { emoji: '🏪', label: 'Built for you', href: '/marketplace', tint: 'bg-white' },
]

function TileContent({ emoji, label }: { emoji: string; label: string }) {
  return (
    <>
      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/80 text-lg shrink-0">
        {emoji}
      </span>
      <span className="text-[13px] font-medium text-indigo leading-tight">{label}</span>
    </>
  )
}

export default function ExploreGrid({ onOpenMonth }: Props) {
  const tileClass = (tint: string) =>
    `${tint} border border-indigo/6 rounded-2xl p-3 flex items-center gap-2.5 active:scale-[0.98] transition-transform text-left min-h-[56px]`

  return (
    <div className="px-5 mb-6">
      <p className="text-[10px] font-semibold text-indigo-muted uppercase tracking-[0.1em] mb-3">
        Explore
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {TILES.map((tile) => {
          if (tile.label === 'This month') {
            return (
              <button
                key={tile.label}
                type="button"
                onClick={onOpenMonth}
                className={tileClass(tile.tint)}
              >
                <TileContent emoji={tile.emoji} label={tile.label} />
              </button>
            )
          }

          return (
            <Link key={tile.label} href={tile.href!} className={tileClass(tile.tint)}>
              <TileContent emoji={tile.emoji} label={tile.label} />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
