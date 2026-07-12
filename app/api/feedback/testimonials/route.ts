import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-admin'

export type Testimonial = {
  comment: string
}

const FALLBACK: Testimonial[] = [
  {
    comment:
      'Finally something that gets what it feels like to budget in SGD while thinking in rupees.',
  },
  {
    comment:
      'The daily brief makes me check in without the guilt spiral. It feels like a friend, not a spreadsheet.',
  },
]

/** Public testimonials: Love-it feedback comments only (no user ids). */
export async function GET() {
  try {
    const supabase = createServiceSupabaseClient()
    const { data, error } = await supabase
      .from('user_feedback')
      .select('comment')
      .eq('rating', 'Love it')
      .not('comment', 'is', null)
      .neq('comment', '')
      .order('created_at', { ascending: false })
      .limit(2)

    if (error) {
      console.error('testimonials fetch failed:', error.message)
      return NextResponse.json({ testimonials: FALLBACK })
    }

    const testimonials = (data ?? [])
      .map((row) => ({ comment: String(row.comment ?? '').trim() }))
      .filter((t) => t.comment.length > 0)
      .slice(0, 2)

    return NextResponse.json({
      testimonials: testimonials.length > 0 ? testimonials : FALLBACK,
    })
  } catch (err) {
    console.error('testimonials route error:', err)
    return NextResponse.json({ testimonials: FALLBACK })
  }
}
