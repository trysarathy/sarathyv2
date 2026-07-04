export interface WiseBalance {
  currency: string
  amount: number
}

export interface WiseTransaction {
  date: string
  description: string
  amount: number
  currency: string
}

export type WiseMode = 'mock' | 'real'
