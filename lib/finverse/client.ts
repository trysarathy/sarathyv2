import { Configuration, LoginIdentityApi, type Transaction } from '@finverse/sdk-typescript'
import type { FinancialBalance, FinancialTransaction } from '@/lib/financial/types'
import { ensureValidAccessToken } from './access-token'
import { getFinverseConfig } from './config'
import { getFinverseConnection } from './token-store'
import { normalizeBalances, normalizeTransactions } from './normalize'

export interface FinverseSyncResult {
  connected: true
  institutionName: string | null
  balances: FinancialBalance[]
  transactions: FinancialTransaction[]
}

const TX_PAGE_SIZE = 500
const MAX_EXPENSES = 50

/** Pull balances and recent expense transactions for a linked user. */
export async function fetchFinverseFinancialData(
  userId: string,
  days: number
): Promise<FinverseSyncResult> {
  const connection = await getFinverseConnection(userId)
  if (!connection) {
    throw new Error('No Finverse bank connection')
  }

  const accessToken = await ensureValidAccessToken(userId)
  const config = getFinverseConfig()
  const dataConfig = new Configuration({
    basePath: config.baseUrl,
    accessToken,
  })
  const api = new LoginIdentityApi(dataConfig)

  const accountsResp = await api.listAccounts()
  const balances = normalizeBalances(accountsResp.data.accounts ?? [])

  const allTransactions: Transaction[] = []
  let offset = 0

  while (true) {
    const txResp = await api.listTransactionsByLoginIdentityId(offset, TX_PAGE_SIZE)
    const batch = txResp.data.transactions ?? []
    allTransactions.push(...batch)
    offset += batch.length
    const total = txResp.data.total_transactions ?? 0
    if (batch.length === 0 || offset >= total) break
  }

  const transactions = normalizeTransactions(allTransactions, days, MAX_EXPENSES)

  return {
    connected: true,
    institutionName: connection.institution_name,
    balances,
    transactions,
  }
}

export interface FinverseStatusResult {
  connected: boolean
  institutionName?: string | null
  linkedAt?: string
}

/** Safe connection summary for the client — no tokens. */
export async function getFinverseStatus(userId: string): Promise<FinverseStatusResult> {
  const connection = await getFinverseConnection(userId)
  if (!connection) return { connected: false }

  return {
    connected: true,
    institutionName: connection.institution_name,
    linkedAt: connection.linked_at,
  }
}
