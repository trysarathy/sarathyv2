'use client'

import { useEffect, useState } from 'react'

/** Small muted-red badge when the device is offline. */
export default function OfflineBadge() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== 'undefined' && !navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 'max(10px, env(safe-area-inset-top))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        background: '#FDE8E4',
        color: '#8A2E1E',
        border: '1px solid #F5C4BB',
        borderRadius: 999,
        padding: '5px 12px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.02em',
        boxShadow: '0 4px 14px rgba(138, 46, 30, 0.12)',
        pointerEvents: 'none',
      }}
      role="status"
      aria-live="polite"
    >
      ● Offline
    </div>
  )
}
