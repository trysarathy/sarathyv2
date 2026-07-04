export interface ParsedTransaction {
  date: string
  description: string
  amount: number
}

export type BankFormat = 'dbs' | 'ocbc' | 'hdfc' | 'icici' | 'wise' | 'paytm' | 'simple'

export interface ParseResult {
  transactions: ParsedTransaction[]
  format: BankFormat
  headerRowIndex: number
}

export type RowRecord = Record<string, string>
