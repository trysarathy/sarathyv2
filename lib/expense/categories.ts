export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Social',
  'Home',
  'Family',
  'Shopping',
  'Health',
  'Education',
  'Entertainment',
  'Other',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const EXPENSE_CATEGORY_EMOJI: Record<ExpenseCategory, string> = {
  Food: '🍔',
  Transport: '🚕',
  Social: '👥',
  Home: '🏠',
  Family: '❤️',
  Shopping: '🛍️',
  Health: '💊',
  Education: '🎓',
  Entertainment: '🎬',
  Other: '📌',
}

export function normalizeExpenseCategory(value: string | null | undefined): ExpenseCategory {
  if (!value) return 'Other'
  const match = EXPENSE_CATEGORIES.find(c => c.toLowerCase() === value.trim().toLowerCase())
  return match ?? 'Other'
}
