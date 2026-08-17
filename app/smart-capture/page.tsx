'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { isAndroidNative } from '@/lib/capacitor/platform'
import {
  hasSmartCaptureBeenPrompted,
  isSmartCaptureEnabled,
  markSmartCapturePrompted,
  openSmartCaptureSettings,
  setSmartCaptureEnabledFlag,
} from '@/lib/capacitor/smart-capture'

const ALLOWED = [
  'Grab & GrabFood',
  'PayNow & DBS PayLah',
  'DBS, OCBC, UOB bank alerts',
  'Wise transfers',
  'Shopee & Foodpanda',
] as const

const NEVER = ['WhatsApp (never)', 'Messages (never)', 'Email (never)'] as const

type Phase = 'prompt' | 'waiting' | 'success'

function SmartCaptureInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromSettings = searchParams.get('from') === 'settings'
  const [phase, setPhase] = useState<Phase>('prompt')
  const [ready, setReady] = useState(false)
  const waitingRef = useRef(false)
  const successTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!isAndroidNative()) {
      router.replace('/home')
      return
    }
    if (!fromSettings && hasSmartCaptureBeenPrompted()) {
      router.replace('/home')
      return
    }
    setReady(true)
  }, [fromSettings, router])

  const goHome = useCallback(() => {
    router.replace('/home')
  }, [router])

  const checkEnabled = useCallback(async () => {
    const enabled = await isSmartCaptureEnabled()
    if (!enabled) return
    setSmartCaptureEnabledFlag(true)
    markSmartCapturePrompted()
    waitingRef.current = false
    setPhase('success')
    if (successTimer.current) window.clearTimeout(successTimer.current)
    successTimer.current = window.setTimeout(() => {
      goHome()
    }, 2800)
  }, [goHome])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (!waitingRef.current) return
      void checkEnabled()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      if (successTimer.current) window.clearTimeout(successTimer.current)
    }
  }, [checkEnabled])

  const handleTurnOn = async () => {
    markSmartCapturePrompted()
    waitingRef.current = true
    setPhase('waiting')
    try {
      await openSmartCaptureSettings()
    } catch (err) {
      console.warn('[smart-capture] open settings failed:', err)
      waitingRef.current = false
      setPhase('prompt')
    }
  }

  const handleLater = () => {
    markSmartCapturePrompted()
    setSmartCaptureEnabledFlag(false)
    goHome()
  }

  if (!ready) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: '#1C0F3F',
        }}
      />
    )
  }

  if (phase === 'success') {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: '#1C0F3F',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 28px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-fraunces), Fraunces, Georgia, serif',
            fontSize: 28,
            fontWeight: 600,
            margin: '0 0 16px',
            lineHeight: 1.25,
          }}
        >
          Smart Capture is on ✓
        </p>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.55,
            color: 'rgba(255,255,255,0.78)',
            maxWidth: 320,
            margin: 0,
          }}
        >
          The next time you pay for anything — watch what happens.
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#1C0F3F',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        padding: 'max(28px, env(safe-area-inset-top)) 24px max(28px, env(safe-area-inset-bottom))',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
        <Image
          src="/icon-192.png"
          alt="Sarathy"
          width={64}
          height={64}
          style={{ borderRadius: 16, marginBottom: 14 }}
          priority
        />
        <h1
          style={{
            fontFamily: 'var(--font-fraunces), Fraunces, Georgia, serif',
            fontSize: 24,
            fontWeight: 600,
            margin: 0,
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          Smart Expense Capture 🪄
        </h1>
      </div>

      <p
        style={{
          fontSize: 17,
          lineHeight: 1.55,
          color: 'rgba(255,255,255,0.88)',
          margin: '0 0 28px',
          textAlign: 'center',
        }}
      >
        Sarathy can automatically catch payment notifications from your apps — so expenses log
        themselves while you just live your life.
      </p>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginBottom: 20,
        }}
      >
        {ALLOWED.map((label) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 15,
              lineHeight: 1.4,
            }}
          >
            <span aria-hidden style={{ fontSize: 16, width: 22, textAlign: 'center' }}>
              ✅
            </span>
            <span>{label}</span>
          </div>
        ))}
        {NEVER.map((label) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 15,
              lineHeight: 1.4,
              color: 'rgba(255,255,255,0.45)',
            }}
          >
            <span aria-hidden style={{ fontSize: 16, width: 22, textAlign: 'center' }}>
              ❌
            </span>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <p
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center',
          margin: '0 0 24px',
        }}
      >
        Sarathy only reads payment confirmations.
        <br />
        It ignores everything else.
        <br />
        You can turn this off anytime in Settings.
      </p>

      {phase === 'waiting' && (
        <p
          style={{
            fontSize: 13,
            color: '#D4A853',
            textAlign: 'center',
            margin: '0 0 12px',
            lineHeight: 1.45,
          }}
        >
          Find Sarathy and turn on notification access, then come back.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={() => void handleTurnOn()}
          style={{
            background: '#D4A853',
            color: '#1C0F3F',
            border: 'none',
            borderRadius: 14,
            padding: '16px 18px',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Turn on Smart Capture
        </button>
        <button
          type="button"
          onClick={handleLater}
          style={{
            background: 'transparent',
            color: 'rgba(255,255,255,0.55)',
            border: 'none',
            borderRadius: 14,
            padding: '14px 18px',
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}

export default function SmartCapturePage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100dvh', background: '#1C0F3F' }} />
      }
    >
      <SmartCaptureInner />
    </Suspense>
  )
}
