'use client'

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'sarathy_install_banner_dismissed_until'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iOS || iPadOs
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return true
  const displayStandalone = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return displayStandalone || iosStandalone
}

function isBrowserDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  // Prefer explicit browser mode; also treat non-standalone as installable browser context
  if (isStandaloneDisplay()) return false
  return (
    window.matchMedia('(display-mode: browser)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    !window.matchMedia('(display-mode: standalone)').matches
  )
}

function isDismissed(): boolean {
  try {
    const until = localStorage.getItem(DISMISS_KEY)
    if (!until) return false
    return Date.now() < Number(until)
  } catch {
    return false
  }
}

function dismissForSevenDays() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000))
  } catch {
    /* ignore */
  }
}

/** Bottom install CTA — only in browser display-mode, not installed PWA. */
export default function InstallAppBanner() {
  const [visible, setVisible] = useState(false)
  const [ios, setIos] = useState(false)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (!isBrowserDisplayMode()) return
    if (isDismissed()) return

    setIos(isIos())
    setVisible(true)

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  if (!visible) return null

  const handleInstall = async () => {
    if (deferred) {
      await deferred.prompt()
      await deferred.userChoice
      setDeferred(null)
      setVisible(false)
      dismissForSevenDays()
      return
    }
    // No native prompt (common on iOS) — keep banner showing iOS instructions
    if (!ios) {
      // Desktop Chrome without deferred event — nothing to do
    }
  }

  const handleDismiss = () => {
    dismissForSevenDays()
    setVisible(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 72,
        zIndex: 90,
        background: '#1C0F3F',
        color: '#FFFFFF',
        borderRadius: 14,
        padding: '14px 14px 14px 16px',
        boxShadow: '0 12px 32px rgba(28, 15, 63, 0.35)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
      role="dialog"
      aria-label="Install Sarathy"
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.45, fontWeight: 600 }}>
          {ios
            ? 'Tap Share → Add to Home Screen'
            : 'Install Sarathy on your home screen for the best experience 📱'}
        </p>
        {ios ? (
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
            Use the Share button <span aria-hidden>⬆️</span> in Safari, then “Add to Home Screen”.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void handleInstall()}
            style={{
              background: '#D4A853',
              color: '#1C0F3F',
              border: 'none',
              borderRadius: 10,
              padding: '9px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Install →
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.55)',
          fontSize: 20,
          lineHeight: 1,
          cursor: 'pointer',
          padding: 2,
        }}
      >
        ×
      </button>
    </div>
  )
}
