import { createBrowserClient } from '@supabase/ssr'

// Client-side Supabase instance (use in all components)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}