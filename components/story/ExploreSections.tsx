'use client'

import { useRouter } from 'next/navigation'
import type { Ref } from 'react'

const C = {
  purpleLight: '#EDE9FE',
  purpleBorder: '#D4C9F9',
  purpleText: '#3C2A8A',
  purpleMuted: '#7B68C0',
  goldLight: '#FEF3DC',
  goldBorder: '#F5DFA0',
  goldText: '#8A5E10',
  goldMuted: '#B08040',
  coral: '#FDE8E4',
  coralBorder: '#F5C4BB',
  coralText: '#8A2E1E',
  coralMuted: '#B06050',
  cream: '#F5EDD8',
} as const

type FeatureRoute = string | 'this-month'

const SECTIONS: {
  id: string
  title: string
  color: { bg: string; border: string; title: string; desc: string; rule: string; label: string }
  features: { id: string; icon: string; name: string; desc: string; route: FeatureRoute }[]
}[] = [
  {
    id: 'know-yourself',
    title: 'Know yourself',
    color: {
      bg: C.purpleLight,
      border: C.purpleBorder,
      title: C.purpleText,
      desc: C.purpleMuted,
      rule: C.purpleBorder,
      label: '#5B3FC4',
    },
    features: [
      { id: 'psychology', icon: '🧠', name: 'Psychology', desc: 'Why you spend how you do', route: '/biases' },
      { id: 'financial-dna', icon: '🧬', name: 'Financial DNA', desc: 'Your money personality', route: '/insights' },
      { id: 'future-you', icon: '🔮', name: 'Future you', desc: "Where you're headed", route: '/future' },
      { id: 'money-check', icon: '😊', name: 'Money check', desc: "How you're doing now", route: '/check' },
    ],
  },
  {
    id: 'your-money',
    title: 'Your money',
    color: {
      bg: C.goldLight,
      border: C.goldBorder,
      title: C.goldText,
      desc: C.goldMuted,
      rule: '#E5CFA0',
      label: '#8A5E10',
    },
    features: [
      { id: 'my-data', icon: '📊', name: 'My data', desc: 'Full spending breakdown', route: '/mydata' },
      { id: 'this-month', icon: '📅', name: 'This month', desc: 'Monthly snapshot', route: 'this-month' },
      { id: 'fixed-costs', icon: '📌', name: 'Fixed costs', desc: 'Bills and recurring', route: '/fixed' },
      { id: 'import', icon: '📄', name: 'Import', desc: 'Upload bank statement', route: '/upload' },
    ],
  },
  {
    id: 'student-life',
    title: 'Student life',
    color: {
      bg: C.coral,
      border: C.coralBorder,
      title: C.coralText,
      desc: C.coralMuted,
      rule: '#E5B4AA',
      label: '#8A2E1E',
    },
    features: [
      { id: 'send-home', icon: '✈️', name: 'Send home', desc: 'Remittance made easy', route: '/remittance' },
      { id: 'built-for-you', icon: '⭐', name: 'Built for you', desc: 'Why Sarathy is different', route: '/marketplace' },
    ],
  },
]

interface Props {
  onOpenMonth?: () => void
  monthTileRef?: Ref<HTMLButtonElement>
}

export default function ExploreSections({ onOpenMonth, monthTileRef }: Props) {
  const router = useRouter()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0 12px' }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#5B3FC4',
            whiteSpace: 'nowrap',
          }}
        >
          Explore Sarathy
        </span>
        <div style={{ flex: 1, height: 1, background: C.purpleBorder }} />
      </div>

      {SECTIONS.map((section) => (
        <div key={section.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0 8px' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: section.color.label,
                whiteSpace: 'nowrap',
              }}
            >
              {section.title}
            </span>
            <div style={{ flex: 1, height: 1, background: section.color.rule }} />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
            }}
          >
            {section.features.map((feat) => {
              const isMonth = feat.route === 'this-month'
              return (
                <button
                  key={feat.id}
                  type="button"
                  ref={isMonth ? monthTileRef : undefined}
                  onClick={() => {
                    if (isMonth) onOpenMonth?.()
                    else router.push(feat.route)
                  }}
                  style={{
                    background: section.color.bg,
                    border: `1px solid ${section.color.border}`,
                    borderRadius: 12,
                    padding: '12px 13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 5 }}>{feat.icon}</div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: section.color.title,
                      lineHeight: 1.3,
                    }}
                  >
                    {feat.name}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: section.color.desc,
                      lineHeight: 1.4,
                      marginTop: 2,
                    }}
                  >
                    {feat.desc}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
