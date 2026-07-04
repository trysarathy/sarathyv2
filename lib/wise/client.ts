import type { WiseBalance, WiseTransaction } from './types'

export interface WiseClient {
  getBalances(): Promise<WiseBalance[]>
  getTransactions(days: number): Promise<WiseTransaction[]>
}
