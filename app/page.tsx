'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function RootPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkSession = async () => {
      const timeout = setTimeout(() => router.replace('/login'), 3000)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        clearTimeout(timeout)
        if (session) {
          router.replace('/home')
        } else {
          router.replace('/login')
        }
      } catch {
        clearTimeout(timeout)
        router.replace('/login')
      }
    }
    checkSession()
  }, [])

  return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center gap-4">
      <div className="text-center">
        <p className="font-fraunces text-4xl font-semibold text-ink">Sarathy</p>
        <p className="text-ink-3 mt-2 text-sm">finding your safe place...</p>
      </div>
      <div className="w-6 h-6 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
