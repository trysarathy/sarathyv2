'use client'

// ─── Sarathy · Today Home Screen ───────────────────────────────────────────
// Light cream + deep purple + gold scheme
// Features grouped into 3 sections — all visible, no clutter
// Savings form moved to Profile/Dreams tab
// ───────────────────────────────────────────────────────────────────────────

import { useEffect, useState, type ReactNode, type Ref } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/calculations'
import { isSpeechRecognitionSupported } from '@/lib/voice/speech-recognition'

// ── Color tokens ───────────────────────────────────────────────────────────
export const TODAY_COLORS = {
  cream: '#F5EDD8',
  creamLight: '#FFFDF7',
  creamBorder: '#E8DFC8',
  purple: '#1C0F3F',
  purpleLight: '#EDE9FE',
  purpleBorder: '#D4C9F9',
  purpleText: '#3C2A8A',
  purpleMuted: '#7B68C0',
  gold: '#D4A853',
  goldLight: '#FEF3DC',
  goldBorder: '#F5DFA0',
  goldText: '#8A5E10',
  goldMuted: '#B08040',
  coral: '#FDE8E4',
  coralBorder: '#F5C4BB',
  coralText: '#8A2E1E',
  coralMuted: '#B06050',
  textDark: '#1C0F3F',
  textMid: '#7A6E5A',
  textLight: '#A09080',
  white: '#FFFFFF',
} as const

const C = TODAY_COLORS

type FeatureRoute = string | 'this-month'

// ── Feature sections (routes match existing app paths) ─────────────────────
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

export interface TodayViewProps {
  safeToSpend: number
  currency: string
  /** When false, hero shows a CTA to set budget instead of a calculated number. */
  hasBudget: boolean
  totalBalance?: ReactNode
  heroRef?: Ref<HTMLDivElement>
  actionsRef?: Ref<HTMLDivElement>
  monthTileRef?: Ref<HTMLButtonElement>
  onLogExpense: () => void
  onVoiceLog: () => void
  onAskSarathy: () => void
  onTapBreakdown: () => void
  onOpenMonth: () => void
  moodSlot?: ReactNode
  accountsSlot?: ReactNode
  children?: ReactNode
}

export default function TodayView({
  safeToSpend,
  currency,
  hasBudget,
  totalBalance,
  heroRef,
  actionsRef,
  monthTileRef,
  onLogExpense,
  onVoiceLog,
  onAskSarathy,
  onTapBreakdown,
  onOpenMonth,
  moodSlot,
  accountsSlot,
  children,
}: TodayViewProps) {
  const router = useRouter()
  const [voiceSupported, setVoiceSupported] = useState(false)

  useEffect(() => {
    setVoiceSupported(isSpeechRecognitionSupported())
  }, [])

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: C.cream,
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 80,
      }}
    >
      {/* ── HERO ── */}
      <div
        ref={heroRef}
        style={{
          background: C.purple,
          padding: '20px 20px 22px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Mandala watermark */}
        <svg
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: -24,
            top: -24,
            width: 160,
            height: 160,
            opacity: 0.09,
            pointerEvents: 'none',
          }}
          viewBox="0 0 200 200"
          fill="none"
        >
          <g stroke={C.gold} strokeWidth="0.9">
            <circle cx="100" cy="100" r="95" />
            <circle cx="100" cy="100" r="72" />
            <circle cx="100" cy="100" r="50" />
            <circle cx="100" cy="100" r="28" />
            <line x1="100" y1="5" x2="100" y2="195" />
            <line x1="5" y1="100" x2="195" y2="100" />
            <line x1="34" y1="34" x2="166" y2="166" />
            <line x1="166" y1="34" x2="34" y2="166" />
            <line x1="100" y1="5" x2="100" y2="195" transform="rotate(22.5 100 100)" />
            <line x1="5" y1="100" x2="195" y2="100" transform="rotate(22.5 100 100)" />
            <ellipse cx="100" cy="66" rx="9" ry="20" transform="rotate(0 100 100)" />
            <ellipse cx="100" cy="66" rx="9" ry="20" transform="rotate(45 100 100)" />
            <ellipse cx="100" cy="66" rx="9" ry="20" transform="rotate(90 100 100)" />
            <ellipse cx="100" cy="66" rx="9" ry="20" transform="rotate(135 100 100)" />
            <ellipse cx="100" cy="66" rx="9" ry="20" transform="rotate(180 100 100)" />
            <ellipse cx="100" cy="66" rx="9" ry="20" transform="rotate(225 100 100)" />
            <ellipse cx="100" cy="66" rx="9" ry="20" transform="rotate(270 100 100)" />
            <ellipse cx="100" cy="66" rx="9" ry="20" transform="rotate(315 100 100)" />
          </g>
        </svg>

        {/* Differentiation badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(212,168,83,0.16)',
            border: '1px solid rgba(212,168,83,0.38)',
            borderRadius: 20,
            padding: '4px 12px',
            marginBottom: 16,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.gold }} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.gold,
              letterSpacing: '0.06em',
            }}
          >
            Built for you — not ChatGPT
          </span>
        </div>

        {/* Safe to spend */}
        <p
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.38)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginBottom: 4,
            position: 'relative',
            zIndex: 1,
          }}
        >
          Safe to spend today
        </p>
        {hasBudget ? (
          <>
            <p
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: C.white,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                marginBottom: 4,
                position: 'relative',
                zIndex: 1,
              }}
            >
              {formatCurrency(safeToSpend, currency)}
            </p>
            {totalBalance && (
              <div
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.42)',
                  marginBottom: 4,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {totalBalance}
              </div>
            )}
            <button
              type="button"
              onClick={onTapBreakdown}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 11,
                color: 'rgba(212,168,83,0.65)',
                cursor: 'pointer',
                padding: 0,
                position: 'relative',
                zIndex: 1,
              }}
            >
              Tap to see how I calculated this →
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => router.push('/profile')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              marginTop: 8,
              textAlign: 'left',
              cursor: 'pointer',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 22,
                fontWeight: 600,
                color: C.gold,
                letterSpacing: '-0.02em',
                lineHeight: 1.35,
              }}
            >
              Set your budget to see your safe-to-spend →
            </span>
          </button>
        )}
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Action row */}
        <div ref={actionsRef} style={{ display: 'flex', gap: 8, padding: '16px 16px 4px' }}>
          <button
            type="button"
            onClick={onLogExpense}
            style={{
              flex: 1,
              background: C.gold,
              color: C.white,
              border: 'none',
              borderRadius: 12,
              padding: '13px 0',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + Log expense
          </button>
          {voiceSupported && (
            <button
              type="button"
              onClick={onVoiceLog}
              aria-label="Voice log expense"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(212,168,83,0.12)',
                border: '1.5px solid rgba(212,168,83,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              🎙️
            </button>
          )}
          <button
            type="button"
            onClick={onAskSarathy}
            style={{
              padding: '13px 14px',
              background: C.white,
              border: `1px solid ${C.creamBorder}`,
              borderRadius: 12,
              fontSize: 13,
              color: C.purple,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Ask Sarathy
          </button>
        </div>

        {/* Money mood */}
        {moodSlot}

        {/* Connected accounts */}
        {accountsSlot && <div style={{ margin: '4px 16px 0' }}>{accountsSlot}</div>}

        {/* ── Feature sections ── */}
        {SECTIONS.map((section) => (
          <div key={section.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 16px 8px' }}>
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
                padding: '0 16px',
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
                      if (isMonth) onOpenMonth()
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

      {children}
    </div>
  )
}
