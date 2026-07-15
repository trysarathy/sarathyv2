import { Suspense } from 'react'
import HomeClient from './HomeClient'

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center bg-cream">
          <div className="w-8 h-8 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  )
}
