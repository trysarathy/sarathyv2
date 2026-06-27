'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Banknote,
  Building2,
  CircleDollarSign,
  Gem,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { getFirstName, getProfileCountryLine, getResponsibilityPhrase } from '@/lib/personalization'
import TabBar from '@/components/ui/TabBar'

type Product = {
  id: string
  name: string
  category: string
  icon: LucideIcon
  tagline: string
  why: string
  cta: string
  url: string
  badge?: string
}

const PRODUCTS: Product[] = [
  { id: 'wise', name: 'Wise', category: 'Remittance', icon: CircleDollarSign, tagline: 'Send money home for less', why: 'Low fees and transparent exchange rates for regular support transfers.', cta: 'Compare rates', url: 'https://wise.com', badge: 'Remittance fit' },
  { id: 'stashaway', name: 'StashAway', category: 'Investing', icon: TrendingUp, tagline: 'Invest your spare change', why: 'Start small with automated, diversified portfolios and no lock-in.', cta: 'Start investing', url: 'https://stashaway.sg', badge: 'Good for beginners' },
  { id: 'dbs', name: 'DBS Student Account', category: 'Banking', icon: Building2, tagline: 'Zero-fee banking for students', why: 'No minimum balance and no fall-below fee for full-time students.', cta: 'Open account', url: 'https://www.dbs.com.sg', badge: 'New arrival fit' },
  { id: 'syfe', name: 'Syfe', category: 'Investing', icon: Target, tagline: 'Goal-based investing', why: 'Connect long-term goals to investment buckets that grow automatically.', cta: 'Explore Syfe', url: 'https://syfe.com' },
  { id: 'remitly', name: 'Remitly', category: 'Remittance', icon: Banknote, tagline: 'Fast transfers, guaranteed rate', why: 'Rate locked when you initiate. Same-day delivery is useful when money needs to arrive fast.', cta: 'Send now', url: 'https://remitly.com' },
  { id: 'gigacover', name: 'Gigacover', category: 'Insurance', icon: ShieldCheck, tagline: 'Student health insurance', why: 'Affordable coverage for international students and gig workers.', cta: 'Get covered', url: 'https://gigacover.com' },
]

const CATS = ['All', 'Remittance', 'Banking', 'Investing', 'Insurance']

export default function MarketplacePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = PRODUCTS.filter(p => filter === 'All' || p.category === filter)
  const firstName = getFirstName(profile)
  const titleName = firstName === 'there' ? 'you' : firstName
  const responsibility = getResponsibilityPhrase(profile)
  const countryLine = getProfileCountryLine(profile)
  const currency = profile?.primary_currency || 'SGD'

  const personalizeProduct = (product: Product) => {
    if (product.category === 'Remittance') {
      const home = profile?.home_country || 'home'
      return {
        ...product,
        tagline: `Support ${home} with less leakage`,
        why: `Useful when ${responsibility} depends on transfers from your ${currency} budget.`,
      }
    }

    if (product.category === 'Investing') {
      return {
        ...product,
        why: `${product.why} Sarathy shows it here because your goals deserve options beyond day-to-day spending.`,
      }
    }

    return product
  }

  if (loading) return (
    <div className="min-h-dvh bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <div className="px-5 pt-12 pb-4">
        <h1 className="font-fraunces text-2xl font-semibold text-ink mb-1">Built for {titleName}</h1>
        <p className="text-ink-3 text-sm">Recommendations filtered around {countryLine.toLowerCase()}.</p>
      </div>

      <div className="mx-5 mb-4 bg-saffron-soft rounded-2xl px-4 py-3">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-saffron" />
          <p className="text-xs text-ink-3 leading-relaxed">
            <span className="font-medium text-ink">How this works:</span> Sarathy may earn a small commission through these links. The list is still filtered for your setup, not generic ads.
          </p>
        </div>
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
        {filtered.map(product => {
          const p = personalizeProduct(product)
          const ProductIcon = p.icon
          return (
          <div key={p.id} className="card">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-saffron-soft text-saffron">
                <ProductIcon className="h-5 w-5" />
              </div>
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
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-saffron">
              {p.cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
          )
        })}
      </div>

      <TabBar active="profile" />
    </div>
  )
}
