'use client'

import { useCallback, useEffect, useState } from 'react'

const DISMISS_KEY = 'sarathy_install_banner_dismissed_until'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __sarathyDeferredInstallPrompt?: BeforeInstallPromptEvent | null
  }
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return true
  const displayStandalone = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return displayStandalone || iosStandalone
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

/**
 * Early capture — beforeinstallprompt often fires before React mounts.
 * Call once from a tiny layout script + again from this component.
 */
export function captureBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  const ev = e as BeforeInstallPromptEvent
  if (typeof window !== 'undefined') {
    window.__sarathyDeferredInstallPrompt = ev
  }
  return ev
}

/** Bottom install CTA — browser only; native prompt on Android/Chrome, Share tips on iOS. */
export default function InstallAppBanner() {
  const [visible, setVisible] = useState(false)
  const [ios, setIos] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)

  const hideInstallButton = useCallback(() => {
    setVisible(false)
    setDeferredPrompt(null)
    if (typeof window !== 'undefined') {
      window.__sarathyDeferredInstallPrompt = null
    }
  }, [])

  const showInstallButton = useCallback(() => {
    if (isStandalone() || isDismissed()) return
    setVisible(true)
  }, [])

  useEffect(() => {
    // 4. Already installed as PWA — never show
    if (isStandalone()) {
      hideInstallButton()
      return
    }
    if (isDismissed()) return

    const onIOS = isIOS()
    setIos(onIOS)

    // iOS: no beforeinstallprompt — show Share instructions
    if (onIOS) {
      showInstallButton()
      return
    }

    // Android/Chrome: pick up early-captured event, then keep listening
    const early = window.__sarathyDeferredInstallPrompt
    if (early) {
      setDeferredPrompt(early)
      showInstallButton()
    }

    const onBip = (e: Event) => {
      const ev = captureBeforeInstallPrompt(e)
      setDeferredPrompt(ev)
      showInstallButton()
    }

    const onInstalled = () => {
      hideInstallButton()
      dismissForSevenDays()
    }

    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [hideInstallButton, showInstallButton])

  // Non-iOS: wait for deferred prompt before showing (dead Install button otherwise)
  if (!visible) return null
  if (!ios && !deferredPrompt) return null

  const handleInstall = async () => {
    if (!deferredPrompt || installing) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const result = await deferredPrompt.userChoice
      if (result.outcome === 'accepted') {
        hideInstallButton()
        dismissForSevenDays()
      }
      setDeferredPrompt(null)
      window.__sarathyDeferredInstallPrompt = null
    } catch (err) {
      console.warn('[pwa] install prompt failed:', err)
    } finally {
      setInstalling(false)
    }
  }

  const handleDismiss = () => {
    dismissForSevenDays()
    hideInstallButton()
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
        {ios ? (
          <>
            <p
              style={{
                margin: '0 0 6px',
                fontSize: 13,
                lineHeight: 1.45,
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              Tap Share <span aria-hidden style={{ fontSize: 16 }}>↑</span> then Add to Home Screen
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: 'rgba(255,255,255,0.6)',
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              Use the Share button in Safari to install Sarathy
            </p>
            <div
              aria-hidden
              style={{
                marginTop: 10,
                textAlign: 'center',
                fontSize: 22,
                lineHeight: 1,
                opacity: 0.85,
                animation: 'sarathyInstallArrowPulse 1.4s ease-in-out infinite',
              }}
            >
              ↑
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.45, fontWeight: 600 }}>
              Install Sarathy on your home screen for the best experience 📱
            </p>
            <button
              type="button"
              onClick={() => void handleInstall()}
              disabled={installing || !deferredPrompt}
              style={{
                background: '#D4A853',
                color: '#1C0F3F',
                border: 'none',
                borderRadius: 10,
                padding: '9px 14px',
                fontSize: 13,
                fontWeight: 700,
                cursor: installing || !deferredPrompt ? 'not-allowed' : 'pointer',
                opacity: installing || !deferredPrompt ? 0.6 : 1,
              }}
            >
              {installing ? 'Installing…' : 'Install →'}
            </button>
          </>
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
      <style>{`
        @keyframes sarathyInstallArrowPulse {
          0%, 100% { transform: translateY(0); opacity: 0.55; }
          50% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
