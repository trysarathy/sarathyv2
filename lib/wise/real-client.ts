import type { WiseClient } from './client'
import type { WiseBalance, WiseTransaction } from './types'

const WISE_API_BASE = 'https://api.sandbox.transferwise.tech'

interface WiseProfile {
  id: number
  type?: string
}

interface WiseBalanceRow {
  currency: string
  amount?: { value: number; currency: string }
  cashAmount?: { value: number; currency: string }
}

interface WiseActivity {
  id: string
  type?: string
  description?: string
  title?: string
  createdOn?: string
  updatedOn?: string
  primaryAmount?: { value: number; currency: string } | string
  secondaryAmount?: { value: number; currency: string } | string
  status?: string
}

export class RealWiseClient implements WiseClient {
  private token: string
  private profileId: number | null = null

  constructor(token: string) {
    this.token = token
  }

  private async request<T>(path: string, query?: Record<string, string>): Promise<T> {
    const url = new URL(path, WISE_API_BASE)
    if (query) {
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Wise API error ${res.status}: ${body.slice(0, 200) || res.statusText}`)
    }

    return res.json() as Promise<T>
  }

  private async getProfileId(): Promise<number> {
    if (this.profileId != null) return this.profileId

    const profiles = await this.request<WiseProfile[]>('/v1/profiles')
    if (!profiles?.length) throw new Error('No Wise profiles found for this token')

    const personal = profiles.find(p => p.type === 'PERSONAL')
    this.profileId = (personal ?? profiles[0]).id
    return this.profileId
  }

  async getBalances(): Promise<WiseBalance[]> {
    const profileId = await this.getProfileId()
    const rows = await this.request<WiseBalanceRow[]>(
      `/v4/profiles/${profileId}/balances`,
      { types: 'STANDARD' }
    )

    return (rows ?? [])
      .map(row => ({
        currency: row.currency || row.amount?.currency || row.cashAmount?.currency || '',
        amount: row.amount?.value ?? row.cashAmount?.value ?? 0,
      }))
      .filter(b => b.currency && b.amount >= 0)
  }

  async getTransactions(days: number): Promise<WiseTransaction[]> {
    const profileId = await this.getProfileId()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    cutoff.setHours(0, 0, 0, 0)

    const data = await this.request<{ activities?: WiseActivity[] } | WiseActivity[]>(
      `/v1/profiles/${profileId}/activities`
    )

    const activities = Array.isArray(data) ? data : (data.activities ?? [])

    return activities
      .map(activity => this.parseActivity(activity))
      .filter((tx): tx is WiseTransaction => tx != null)
      .filter(tx => new Date(tx.date + 'T00:00:00') >= cutoff)
      .sort((a, b) => b.date.localeCompare(a.date))
  }

  private parseActivity(activity: WiseActivity): WiseTransaction | null {
    const status = activity.status?.toUpperCase()
    if (status && ['FAILED', 'CANCELLED', 'REJECTED'].includes(status)) return null

    const { value, currency } = this.parseAmountField(activity.primaryAmount)
    if (value == null || !currency) return null

    // Outgoing = negative primary amount → expense
    if (value >= 0) return null

    const dateRaw = activity.createdOn ?? activity.updatedOn
    if (!dateRaw) return null

    const date = dateRaw.slice(0, 10)
    const description = (activity.description || activity.title || activity.type || 'Wise transaction').trim()
    if (!description) return null

    return {
      date,
      description,
      amount: Math.abs(value),
      currency,
    }
  }

  private parseAmountField(
    field: WiseActivity['primaryAmount']
  ): { value: number | null; currency: string } {
    if (field == null) return { value: null, currency: '' }
    if (typeof field === 'object') {
      return { value: field.value ?? null, currency: field.currency ?? '' }
    }
    const n = parseFloat(String(field).replace(/,/g, ''))
    return { value: isNaN(n) ? null : n, currency: '' }
  }
}

export function createRealWiseClient(): RealWiseClient {
  const token = process.env.WISE_API_TOKEN?.trim()
  if (!token) {
    throw new Error('WISE_API_TOKEN is not configured. Set WISE_MODE=mock or add your token.')
  }
  return new RealWiseClient(token)
}
