import { parseCSVText } from './parse-csv'
import { detectFormat } from './detect-format'
import { ADAPTERS } from './adapters'
import type { ParseResult } from './types'

export type { ParsedTransaction, BankFormat, ParseResult } from './types'

/** Parse a bank statement CSV with format detection and bank-specific adapters. */
export function parseBankStatement(text: string): ParseResult {
  const rows = parseCSVText(text)
  if (rows.length === 0) {
    return { transactions: [], format: 'simple', headerRowIndex: 0 }
  }

  const { format, headerRowIndex } = detectFormat(rows)
  const headers = rows[headerRowIndex]
  const dataRows = rows.slice(headerRowIndex + 1)

  const adapter = ADAPTERS[format] ?? ADAPTERS.simple
  let transactions = adapter(headers, dataRows)

  // If a detected format yields nothing, retry with the simple adapter
  if (transactions.length === 0 && format !== 'simple') {
    transactions = ADAPTERS.simple(headers, dataRows)
  }

  return { transactions, format, headerRowIndex }
}

export function formatBankLabel(format: ParseResult['format']): string {
  const labels: Record<ParseResult['format'], string> = {
    dbs: 'DBS',
    ocbc: 'OCBC',
    hdfc: 'HDFC',
    icici: 'ICICI',
    wise: 'Wise',
    paytm: 'Paytm',
    simple: 'Generic CSV',
  }
  return labels[format]
}
