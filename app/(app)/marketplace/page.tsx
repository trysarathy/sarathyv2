'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import TabBar from '@/components/ui/TabBar'

const PRODUCTS = [
  { id: 'wise', name: 'Wise', category: 'Remittance', emoji: '💚', tagline: 'Send money home for less', why: 'The lowest fees for SGD to INR transfers. Most students save SGD 8-15 per transfer vs bank wire.', cta: 'Compare rates', url: 'https://wise.com', badge: 'Most popular for NRIs' },
  { id: 'stashaway', name: 'StashAway', category: 'Investing', emoji: '📈', tagline: 'Invest your spare change', why: 'Start with SGD 1. Automated, diversified, no lock-in. Good for students with irregular income.', cta: 'Start investing', url: 'https://stashaway.sg', badge: 'Good for beginners' },
  { id: 'dbs', name: 'DBS Student Account', category: 'Banking', emoji: '🏦', tagline: 'Zero-fee banking for students', why: 'No minimum balance, no fall-below fee for full-time students. Easiest account to open in Singapore.', cta: 'Open account', url: 'https://www.dbs.com.sg', badge: 'Best for new arrivals' },
  { id: 'syfe', name: 'Syfe', category: 'Investing', emoji: '🎯', tagline: 'Goal-based investing', why: 'Link your Sarathy goals to real investments. Emergency fund, trip fund — all growing automatically.', cta: 'Explore Syfe', url: 'https://syfe.com' },
  { id: 'remitly', name: 'Remitly', category: 'Remittance', emoji: '🔵', tagline: 'Fast transfers, guaranteed rate', why: 'Rate locked when you initiate. Same day delivery available. Good when you need money to arrive fast.', cta: 'Send now', url: 'https://remitly.com' },
  { id: 'gigacover', name: 'Gigacover', category: 'Insurance', emoji: '🛡️', tagline: 'Student health insurance', why: 'Affordable coverage for international students and gig workers. From SGD 1.50 per day.', cta: 'Get covered', url: 'https://gigacover.com' },
]

const CATS = ['All', 'Remittance', 'Banking', 'Investing', 'Insurance']

export default function MarketplacePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = PRODUCTS.filter(p => filter === 'All' || p.category === filter)

  if (loading) return (
    <div className="min-h-dvh bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <div className="px-5 pt-12 pb-4">
        <h1 className="font-fraunces text-2xl font-semibold text-ink mb-1">Built for you</h1>
        <p className="text-ink-3 text-sm">Sarathy only shows products that match your profile — never generic ads</p>
      </div>

      <div className="mx-5 mb-4 bg-saffron-soft rounded-2xl px-4 py-3">
        <p className="text-xs text-ink-3 leading-relaxed">
          🌸 <span className="font-medium text-ink">How this works:</span> Sarathy earns a small commission if you sign up through these links. This keeps the app free. We only list products we would recommend to a friend.
        </p>
      </div>

      <div className="px-5 mb-4 flex gap-2 overflow-x-auto pb-1">
        {CATS.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`flex-shrink-0 text-xs font-medium px-4 py-2 rounded-full transition-colors ${filter === cat ? 'bg-saffron text-white' : 'bg-white text-ink-3 shadow-sm'}`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="px-5 flex flex-col gap-3">
        {filtered.map(p => (
          <div key={p.id} className="card">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{p.emoji}</span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-ink text-sm">{p.name}</p>
                  {p.badge && <span className="text-xs bg-saffron-soft text-saffron px-2 py-0.5 rounded-full font-medium">{p.badge}</span>}
                </div>
                <p className="text-xs text-ink-3">{p.category}</p>
              </div>
            </div>
            <p className="text-sm font-medium text-ink mb-1">{p.tagline}</p>
            <p className="text-xs text-ink-3 leading-relaxed mb-3">{p.why}</p>
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-saffron">
              {p.cta} →
            </a>
          </div>
        ))}
      </div>

      <TabBar active="profile" />
    </div>
  )
}
