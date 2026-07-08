/**
 * Delete today's cached daily briefs so they regenerate with current context.
 * Run: npx tsx scripts/clear-today-briefs.ts
 */
import { createServiceSupabaseClient } from '../lib/supabase-admin'
import { todayInSingapore } from '../lib/sarathy/sgt'

async function main() {
  const supabase = createServiceSupabaseClient()
  const today = todayInSingapore()

  const { data: briefs, error: listError } = await supabase
    .from('daily_briefs')
    .select('id, user_id, brief_date')
    .eq('brief_date', today)

  if (listError) throw listError

  if (!briefs?.length) {
    console.log(`No daily briefs for ${today}`)
    return
  }

  const { error: deleteError, count } = await supabase
    .from('daily_briefs')
    .delete({ count: 'exact' })
    .eq('brief_date', today)

  if (deleteError) throw deleteError

  console.log(`Deleted ${count ?? briefs.length} daily brief(s) for ${today}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
