import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Sarathy — Shared receipt',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#1C0F3F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

/** Minimal chrome — no TabBar / feedback. Share flow exits via history.back(). */
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
