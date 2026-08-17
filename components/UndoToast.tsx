'use client'

import { useEffect, useRef, type MouseEvent } from 'react'
import { currencySymbol } from '@/lib/currency/convert'

export interface UndoToastProps {
  amount: number
  currency: string
  description: string
  onUndo: () => void | Promise<void>
  onDismiss: () => void
  /** Opens the logged expense for editing when the pill body is tapped. */
  onEdit?: () => void
  durationSeconds?: number
  /**
   * When true (default), navigates back / home after dismiss or undo.
   * Set false on in-app surfaces (e.g. home notification capture).
   */
  autoLeave?: boolean
}

function leaveShareOrigin() {
  try {
    if (window.history.length > 1) {
      window.history.back()
      return
    }
  } catch {
    /* ignore */
  }
  window.location.href = '/home'
}

function formatLoggedAmount(amount: number, currency: string): string {
  const n = Number.isFinite(amount) ? amount : 0
  const symbol = currencySymbol(currency)
  // Avoid "SGDSGD8.50" if caller already passed a symbol
  const prefix = /[$£€¥₹₫₱৳]/.test(currency) || currency.endsWith('$') ? currency : symbol
  return `${prefix}${n.toFixed(2)}`
}

/**
 * Bottom-center undo pill for Share → Sarathy auto-log.
 * Progress bar depletes over `durationSeconds`, then dismisses + history.back().
 */
export default function UndoToast({
  amount,
  currency,
  description,
  onUndo,
  onDismiss,
  onEdit,
  durationSeconds = 6,
  autoLeave = true,
}: UndoToastProps) {
  const finishedRef = useRef(false)
  const durationMs = Math.max(0.5, durationSeconds) * 1000

  useEffect(() => {
    finishedRef.current = false
    const id = window.setTimeout(() => {
      if (finishedRef.current) return
      finishedRef.current = true
      onDismiss()
      if (autoLeave) leaveShareOrigin()
    }, durationMs)
    return () => window.clearTimeout(id)
  }, [autoLeave, durationMs, onDismiss])

  const handleUndo = async (e: MouseEvent) => {
    e.stopPropagation()
    if (finishedRef.current) return
    finishedRef.current = true
    try {
      await onUndo()
    } finally {
      if (autoLeave) leaveShareOrigin()
    }
  }

  const handleBodyClick = () => {
    if (finishedRef.current) return
    if (!onEdit) return
    finishedRef.current = true
    onEdit()
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Logged ${description}. Undo available.`}
      onClick={handleBodyClick}
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'max(24px, env(safe-area-inset-bottom))',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: '#221050',
        borderRadius: 100,
        padding: '12px 20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        minWidth: 220,
        maxWidth: 'calc(100vw - 32px)',
        cursor: onEdit ? 'pointer' : 'default',
        overflow: 'hidden',
        animation: 'undoToastSlideUp 0.35s ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <span
          aria-hidden
          style={{
            color: '#D4A853',
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ✓
        </span>
        <span
          style={{
            flex: 1,
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Logged · {formatLoggedAmount(amount, currency)}
        </span>
        <button
          type="button"
          onClick={(e) => void handleUndo(e)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            margin: 0,
            color: '#D4A853',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Undo
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          background: 'rgba(212, 168, 83, 0.2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: '100%',
            background: '#D4A853',
            transformOrigin: 'left center',
            animation: `undoToastProgress ${durationMs}ms linear forwards`,
          }}
        />
      </div>

      <style>{`
        @keyframes undoToastSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes undoToastProgress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [role="status"] {
            animation: none !important;
          }
          [role="status"] [style*="undoToastProgress"],
          [role="status"] div div {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}
