/** Pending expense split draft — carried from Log Expense → Circles. */

export type PendingCircleSplit = {
  amount: number
  description: string
  category: string
}

const STORAGE_KEY = 'sarathy_pending_circle_split'

export function savePendingCircleSplit(draft: PendingCircleSplit): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    /* private mode / quota */
  }
}

export function readPendingCircleSplit(): PendingCircleSplit | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingCircleSplit
    if (typeof parsed.amount !== 'number' || parsed.amount <= 0) return null
    return {
      amount: parsed.amount,
      description: typeof parsed.description === 'string' ? parsed.description : '',
      category: typeof parsed.category === 'string' ? parsed.category : 'Social',
    }
  } catch {
    return null
  }
}

export function clearPendingCircleSplit(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function pendingSplitQuery(draft: PendingCircleSplit): string {
  const params = new URLSearchParams({
    amount: String(draft.amount),
    description: draft.description,
    category: draft.category,
    openSplit: '1',
  })
  return params.toString()
}

export function parsePendingSplitFromSearch(
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): PendingCircleSplit | null {
  const amountRaw = searchParams.get('amount')
  const amount = amountRaw ? parseFloat(amountRaw) : NaN
  if (!Number.isFinite(amount) || amount <= 0) {
    return readPendingCircleSplit()
  }
  return {
    amount,
    description: searchParams.get('description') || '',
    category: searchParams.get('category') || 'Social',
  }
}
