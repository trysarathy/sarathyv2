import { addDaysToDateString, todayInSingapore } from '@/lib/sarathy/sgt'
import {
  EXPENSE_CATEGORY_EMOJI,
  type ExpenseCategory,
  normalizeExpenseCategory,
} from '@/lib/expense/categories'
import type { BudgetEntry } from '@/types'

export type QuickLogChip = {
  id: string
  label: string
  emoji: string
  category: ExpenseCategory
  subcategory: string | null
  /** Prefill amount in the user's primary currency. */
  amount: number
}

const FALLBACK_CHIPS: QuickLogChip[] = [
  {
    id: 'fallback-hawker',
    label: 'Hawker',
    emoji: '🍔',
    category: 'Food',
    subcategory: 'Hawker',
    amount: 5,
  },
  {
    id: 'fallback-mrt',
    label: 'MRT',
    emoji: '🚌',
    category: 'Transport',
    subcategory: 'MRT/Bus',
    amount: 2,
  },
  {
    id: 'fallback-coffee',
    label: 'Coffee',
    emoji: '☕',
    category: 'Food',
    subcategory: 'Coffee',
    amount: 5,
  },
]

/** Friendly chip labels / emojis for known subcategories. */
const CHIP_PRESENTATION: Record<string, { label: string; emoji: string }> = {
  hawker: { label: 'Hawker', emoji: '🍔' },
  'mrt/bus': { label: 'MRT', emoji: '🚌' },
  mrt: { label: 'MRT', emoji: '🚌' },
  bus: { label: 'Bus', emoji: '🚌' },
  coffee: { label: 'Coffee', emoji: '☕' },
  'bubble tea': { label: 'Bubble Tea', emoji: '🧋' },
  grab: { label: 'Grab', emoji: '🚕' },
  groceries: { label: 'Groceries', emoji: '🛒' },
  delivery: { label: 'Delivery', emoji: '🛵' },
  restaurant: { label: 'Restaurant', emoji: '🍽️' },
}

function chipKey(entry: BudgetEntry): string {
  const category = normalizeExpenseCategory(entry.category)
  const sub = entry.subcategory?.trim()
  if (sub) return `${category}::${sub.toLowerCase()}`
  // Fall back to description keyword for older entries without subcategory
  const desc = (entry.description || '').toLowerCase()
  for (const key of Object.keys(CHIP_PRESENTATION)) {
    if (desc.includes(key.replace('/', ' ')) || desc.includes(key)) {
      return `${category}::${key}`
    }
  }
  return `${category}::`
}

function presentChip(
  category: ExpenseCategory,
  subcategory: string | null,
  amount: number
): QuickLogChip {
  const subKey = (subcategory || '').toLowerCase()
  const known = CHIP_PRESENTATION[subKey]
  const label = known?.label || subcategory || category
  const emoji = known?.emoji || EXPENSE_CATEGORY_EMOJI[category]
  const id = `${category}-${subKey || 'main'}`
  return { id, label, emoji, category, subcategory, amount }
}

/** Most frequent rounded amount; ties broken by closeness to average. */
function pickAmount(amounts: number[]): number {
  if (amounts.length === 0) return 0
  const rounded = amounts.map((a) => Math.round(a * 100) / 100)
  const counts = new Map<number, number>()
  for (const a of rounded) counts.set(a, (counts.get(a) || 0) + 1)

  let best = rounded[0]
  let bestCount = 0
  for (const [value, count] of Array.from(counts.entries())) {
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }

  // If no clear mode (all unique), use average
  if (bestCount === 1 && rounded.length > 1) {
    const avg = rounded.reduce((s, a) => s + a, 0) / rounded.length
    return Math.round(avg * 100) / 100
  }
  return best
}

function parseChipKey(key: string): { category: ExpenseCategory; subcategory: string | null } {
  const [cat, ...rest] = key.split('::')
  const category = normalizeExpenseCategory(cat)
  const raw = rest.join('::').trim()
  if (!raw) return { category, subcategory: null }

  // Normalize known aliases back to canonical subcategory names
  if (raw === 'mrt' || raw === 'bus') return { category, subcategory: 'MRT/Bus' }
  const known = CHIP_PRESENTATION[raw]
  if (known) {
    // Prefer canonical subcategory casing from presentation label when it matches presets
    const canonical =
      raw === 'mrt/bus'
        ? 'MRT/Bus'
        : known.label === 'Bubble Tea'
          ? 'Bubble Tea'
          : known.label
    return { category, subcategory: canonical }
  }
  return { category, subcategory: raw }
}

/**
 * Top 3 personalised quick-log chips from the last 30 days,
 * ranked by frequency. Amount = most common (else average).
 */
export function buildQuickLogChips(
  entries: BudgetEntry[],
  options?: { limit?: number; now?: string }
): QuickLogChip[] {
  const limit = options?.limit ?? 3
  const today = options?.now ?? todayInSingapore()
  const cutoff = addDaysToDateString(today, -30)

  const recent = entries.filter((e) => e.entry_date >= cutoff && e.entry_date <= today)

  const groups = new Map<string, number[]>()
  for (const entry of recent) {
    if (!Number.isFinite(entry.amount) || entry.amount <= 0) continue
    const key = chipKey(entry)
    const list = groups.get(key) || []
    list.push(entry.amount)
    groups.set(key, list)
  }

  const ranked = Array.from(groups.entries())
    .map(([key, amounts]) => ({
      key,
      count: amounts.length,
      amount: pickAmount(amounts),
    }))
    .sort((a, b) => b.count - a.count || b.amount - a.amount)

  const chips: QuickLogChip[] = []
  const seenLabels = new Set<string>()

  for (const row of ranked) {
    if (chips.length >= limit) break
    const { category, subcategory } = parseChipKey(row.key)
    const chip = presentChip(category, subcategory, row.amount)
    const labelKey = chip.label.toLowerCase()
    if (seenLabels.has(labelKey)) continue
    seenLabels.add(labelKey)
    chips.push(chip)
  }

  // Fill with sensible student defaults if history is thin
  for (const fallback of FALLBACK_CHIPS) {
    if (chips.length >= limit) break
    if (seenLabels.has(fallback.label.toLowerCase())) continue
    seenLabels.add(fallback.label.toLowerCase())
    chips.push({ ...fallback })
  }

  return chips.slice(0, limit)
}
