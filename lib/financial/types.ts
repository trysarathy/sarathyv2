export interface FinancialBalance {
  currency: string
  amount: number
}

export interface FinancialTransaction {
  date: string
  description: string
  amount: number
  currency: string
}
