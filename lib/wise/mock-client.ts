import type { WiseClient } from './client'
import type { WiseBalance, WiseTransaction } from './types'

const MOCK_BALANCES: WiseBalance[] = [
  { currency: 'SGD', amount: 842.50 },
  { currency: 'INR', amount: 12400 },
]

/** ~15 realistic student transactions over the last 30 days (SGD expenses). */
const MOCK_TRANSACTIONS: WiseTransaction[] = [
  { date: '2026-06-05', description: 'Grab ride to SMU', amount: 12.80, currency: 'SGD' },
  { date: '2026-06-07', description: 'FairPrice Finest — groceries', amount: 47.35, currency: 'SGD' },
  { date: '2026-06-09', description: 'Remittance to India (HDFC ****4521)', amount: 350.00, currency: 'SGD' },
  { date: '2026-06-11', description: 'foodpanda — Thai Express', amount: 18.90, currency: 'SGD' },
  { date: '2026-06-13', description: 'SimplyGo — MRT top-up', amount: 20.00, currency: 'SGD' },
  { date: '2026-06-15', description: 'Koufu @ SMU', amount: 6.50, currency: 'SGD' },
  { date: '2026-06-17', description: 'Grab ride — Clarke Quay', amount: 15.20, currency: 'SGD' },
  { date: '2026-06-19', description: 'Cold Storage — snacks', amount: 22.15, currency: 'SGD' },
  { date: '2026-06-21', description: 'Deliveroo — Pizza Hut', amount: 28.40, currency: 'SGD' },
  { date: '2026-06-23', description: 'SimplyGo — MRT top-up', amount: 20.00, currency: 'SGD' },
  { date: '2026-06-25', description: 'Koufu @ SMU', amount: 5.80, currency: 'SGD' },
  { date: '2026-06-27', description: 'Spotify Premium', amount: 10.98, currency: 'SGD' },
  { date: '2026-06-29', description: 'Grab ride — Bugis', amount: 11.50, currency: 'SGD' },
  { date: '2026-07-01', description: 'FairPrice — weekly shop', amount: 38.60, currency: 'SGD' },
  { date: '2026-07-03', description: 'Netflix', amount: 15.98, currency: 'SGD' },
]

function daysAgo(isoDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(isoDate + 'T00:00:00')
  return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
}

export class MockWiseClient implements WiseClient {
  async getBalances(): Promise<WiseBalance[]> {
    return MOCK_BALANCES.map(b => ({ ...b }))
  }

  async getTransactions(days: number): Promise<WiseTransaction[]> {
    return MOCK_TRANSACTIONS
      .filter(tx => daysAgo(tx.date) <= days)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(tx => ({ ...tx }))
  }
}
