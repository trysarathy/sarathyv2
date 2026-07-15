'use client'

import { useEffect } from 'react'
import { registerSarathyServiceWorker } from '@/lib/notifications/client'

/** Registers the Web Push service worker once on the client. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    void registerSarathyServiceWorker()
  }, [])
  return null
}
