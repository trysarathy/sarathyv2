'use client'

// ─── Sarathy · Today Home Screen ───────────────────────────────────────────
// Light cream + deep purple + gold scheme
// Focused: hero, actions, mood, accounts, this-month card
// ───────────────────────────────────────────────────────────────────────────

import { useEffect, useState, type ReactNode, type Ref } from 'react'
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

export interface TodayViewProps {
  safeToSpend: number
  currency: string
  /**
   * When true, hero shows the calculated safe-to-spend.
   * Requires planning_amount set AND at least one expense logged.
   */
  showSafeToSpend: boolean
  totalBalance?: ReactNode
  heroRef?: Ref<HTMLDivElement>
  actionsRef?: Ref<HTMLDivElement>
  monthCardRef?: Ref<HTMLDivElement>
  onLogExpense: () => void
  onVoiceLog: () => void
  onAskSarathy: () => void
  onTapBreakdown: () => void
  onSetupBudget?: () => void
  moodSlot?: ReactNode
  accountsSlot?: ReactNode
  monthCardSlot?: ReactNode
  children?: ReactNode
}

export default function TodayView({
  safeToSpend,
  currency,
  showSafeToSpend,
  totalBalance,
  heroRef,
  actionsRef,
  monthCardRef,
  onLogExpense,
  onVoiceLog,
  onAskSarathy,
  onTapBreakdown,
  onSetupBudget,
  moodSlot,
  accountsSlot,
  monthCardSlot,
  children,
}: TodayViewProps) {
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
            Your money companion
          </span>
        </div>

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
        {showSafeToSpend ? (
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
            <p
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.42)',
                marginBottom: 6,
                position: 'relative',
                zIndex: 1,
              }}
            >
              Based on today&apos;s expenses only
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
            onClick={() => {
              if (onSetupBudget) onSetupBudget()
              else {
                document.getElementById('this-month-card')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                })
              }
            }}
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

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 24 }}>
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

        {moodSlot}

        {accountsSlot && <div style={{ margin: '4px 16px 0' }}>{accountsSlot}</div>}

        {monthCardSlot && (
          <div ref={monthCardRef} style={{ margin: '12px 16px 0' }}>
            {monthCardSlot}
          </div>
        )}
      </div>

      {children}
    </div>
  )
}
