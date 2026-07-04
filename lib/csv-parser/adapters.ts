import type { ParsedTransaction } from './types'
import {
  expenseAmount,
  getField,
  MAX_TRANSACTIONS,
  parseDate,
  parseAmount,
  rowsToRecords,
} from './utils'

type Adapter = (headers: string[], dataRows: string[][]) => ParsedTransaction[]

function pushTx(
  out: ParsedTransaction[],
  date: string,
  description: string,
  amount: number | null
) {
  if (!date || !description?.trim() || amount == null || amount <= 0) return
  out.push({ date, description: description.trim(), amount })
}

const dbsAdapter: Adapter = (headers, dataRows) => {
  const records = rowsToRecords(headers, dataRows)
  const out: ParsedTransaction[] = []
  for (const row of records) {
    const date = parseDate(getField(row, headers, 'transactiondate', 'date', 'valuedate'))
    const description = getField(row, headers, 'transactiondescription', 'description', 'details', 'narration')
    const amount = expenseAmount(
      getField(row, headers, 'withdrawal', 'withdrawals', 'withdrawalamount', 'debit'),
      getField(row, headers, 'deposit', 'deposits', 'depositamount', 'credit')
    )
    pushTx(out, date, description, amount)
    if (out.length >= MAX_TRANSACTIONS) break
  }
  return out
}

const ocbcAdapter: Adapter = (headers, dataRows) => {
  const records = rowsToRecords(headers, dataRows)
  const out: ParsedTransaction[] = []
  for (const row of records) {
    const date = parseDate(getField(row, headers, 'transactiondate', 'date', 'postingdate'))
    const description = getField(row, headers, 'description', 'transactiondescription', 'details')
    const amount = expenseAmount(
      getField(row, headers, 'withdrawal', 'withdrawals', 'debit'),
      getField(row, headers, 'deposit', 'deposits', 'credit')
    )
    pushTx(out, date, description, amount)
    if (out.length >= MAX_TRANSACTIONS) break
  }
  return out
}

const hdfcAdapter: Adapter = (headers, dataRows) => {
  const records = rowsToRecords(headers, dataRows)
  const out: ParsedTransaction[] = []
  for (const row of records) {
    const date = parseDate(getField(row, headers, 'date', 'valuedt', 'valuedate', 'transactiondate'))
    const description = getField(row, headers, 'narration', 'description', 'transactionparticulars')
    const amount = expenseAmount(
      getField(row, headers, 'withdrawalamt', 'withdrawalamount', 'withdrawal', 'debit'),
      getField(row, headers, 'depositamt', 'depositamount', 'deposit', 'credit')
    )
    pushTx(out, date, description, amount)
    if (out.length >= MAX_TRANSACTIONS) break
  }
  return out
}

const iciciAdapter: Adapter = (headers, dataRows) => {
  const records = rowsToRecords(headers, dataRows)
  const out: ParsedTransaction[] = []
  for (const row of records) {
    const date = parseDate(getField(row, headers, 'date', 'transactiondate', 'valuedate'))
    const description = getField(row, headers, 'transactionremarks', 'remarks', 'description', 'narration')
    const amount = expenseAmount(
      getField(row, headers, 'withdrawalamountinr', 'withdrawalamount', 'withdrawal', 'debit'),
      getField(row, headers, 'depositamountinr', 'depositamount', 'deposit', 'credit')
    )
    pushTx(out, date, description, amount)
    if (out.length >= MAX_TRANSACTIONS) break
  }
  return out
}

const wiseAdapter: Adapter = (headers, dataRows) => {
  const records = rowsToRecords(headers, dataRows)
  const out: ParsedTransaction[] = []
  for (const row of records) {
    const status = getField(row, headers, 'status').toLowerCase()
    if (status && status !== 'completed' && status !== 'sent' && status !== 'received') continue

    const date = parseDate(getField(row, headers, 'date', 'createdon', 'transactiondate'))
    const description = getField(row, headers, 'description', 'merchant', 'payee', 'recipient')
    const rawAmount = getField(row, headers, 'amount', 'totalamount')
    const parsed = parseAmount(rawAmount)
    // Wise: negative = outgoing (expense), positive = incoming (skip)
    const amount = parsed != null && parsed < 0 ? Math.abs(parsed) : null
    pushTx(out, date, description || 'Wise transfer', amount)
    if (out.length >= MAX_TRANSACTIONS) break
  }
  return out
}

const paytmAdapter: Adapter = (headers, dataRows) => {
  const records = rowsToRecords(headers, dataRows)
  const out: ParsedTransaction[] = []
  for (const row of records) {
    const status = getField(row, headers, 'status').toLowerCase()
    if (status && (status.includes('failed') || status.includes('pending'))) continue

    const date = parseDate(getField(row, headers, 'transactiondate', 'date', 'datetime'))
    const description = getField(row, headers, 'transactiondetails', 'details', 'description', 'merchantname')
    const rawAmount = getField(row, headers, 'amount', 'debited', 'paid')
    const parsed = parseAmount(rawAmount)
    // Paytm debits often shown as negative or with "Dr" — treat absolute value as expense
    const amount = parsed != null ? Math.abs(parsed) : null
    pushTx(out, date, description, amount)
    if (out.length >= MAX_TRANSACTIONS) break
  }
  return out
}

/** Generic 3-column fallback: date | description | amount (first positive or any non-zero). */
const simpleAdapter: Adapter = (headers, dataRows) => {
  const records = rowsToRecords(headers, dataRows)
  const out: ParsedTransaction[] = []

  for (const row of records) {
    let date = getField(row, headers, 'date', 'transactiondate', 'entrydate')
    let description = getField(row, headers, 'description', 'narration', 'details', 'memo', 'particulars')
    let amountRaw = getField(row, headers, 'amount', 'debit', 'withdrawal', 'value')

    // Positional fallback when headers don't match
    if (!date && headers.length >= 1) date = row[headers[0]] ?? ''
    if (!description && headers.length >= 2) description = row[headers[1]] ?? ''
    if (!amountRaw) {
      for (let j = 2; j < headers.length; j++) {
        const candidate = row[headers[j]] ?? ''
        const n = parseAmount(candidate)
        if (n != null && n !== 0) {
          amountRaw = candidate
          break
        }
      }
    }

    const parsed = parseAmount(amountRaw)
    const amount = parsed != null ? Math.abs(parsed) : null
    pushTx(out, parseDate(date), description, amount)
    if (out.length >= MAX_TRANSACTIONS) break
  }

  return out
}

export const ADAPTERS: Record<string, Adapter> = {
  dbs: dbsAdapter,
  ocbc: ocbcAdapter,
  hdfc: hdfcAdapter,
  icici: iciciAdapter,
  wise: wiseAdapter,
  paytm: paytmAdapter,
  simple: simpleAdapter,
}
