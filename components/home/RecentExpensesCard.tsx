'use client'

import { formatCurrency, getCategoryEmoji } from '@/lib/calculations'
import { formatRelativeEntryDate } from '@/lib/sarathy/sgt'
import type { BudgetEntry } from '@/types'

interface Props {
  entries: BudgetEntry[]
  currency: string
  onSeeAll?: () => void
}

function formatAmount(amount: number, currency: string): string {
  const n = Number.isFinite(amount) ? amount : 0
  if (currency === 'SGD') return `S$${n.toFixed(2)}`
  if (currency === 'INR') return `₹${n.toFixed(2)}`
  if (currency === 'BRL') return `R$${n.toFixed(2)}`
  if (currency === 'CNY') return `¥${n.toFixed(2)}`
  if (currency === 'VND') return `₫${n.toFixed(0)}`
  if (currency === 'PHP') return `₱${n.toFixed(2)}`
  if (currency === 'USD') return `$${n.toFixed(2)}`
  if (currency === 'GBP') return `£${n.toFixed(2)}`
  return formatCurrency(amount, currency)
}

export default function RecentExpensesCard({ entries, currency, onSeeAll }: Props) {
  const recent = [...entries]
    .sort((a, b) => {
      const byDate = b.entry_date.localeCompare(a.entry_date)
      if (byDate !== 0) return byDate
      return (b.created_at || '').localeCompare(a.created_at || '')
    })
    .slice(0, 5)

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8DFC8',
        borderRadius: 12,
        padding: '14px 14px 12px',
      }}
    >
      <p
        style={{
          margin: '0 0 12px',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#8A5E10',
        }}
      >
        Recent expenses
      </p>

      {recent.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: '#7A6E5A',
            lineHeight: 1.45,
          }}
        >
          No expenses yet this month — log your first one above 👆
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recent.map((entry, index) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: index < recent.length - 1 ? '1px solid #F0E8DC' : 'none',
                }}
              >
                <div style={{ display: 'flex', gap: 10, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }} aria-hidden>
                    {getCategoryEmoji(entry.category)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#1C0F3F',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.description?.trim() || entry.category}
                    </p>
                    <p
                      style={{
                        margin: '3px 0 0',
                        fontSize: 12,
                        color: '#A09080',
                        fontWeight: 500,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0 8px',
                        lineHeight: 1.35,
                      }}
                    >
                      <span>
                        {entry.category}
                        {entry.subcategory ? ` · ${entry.subcategory}` : ''}
                      </span>
                      <span>{formatRelativeEntryDate(entry.entry_date)}</span>
                    </p>
                  </div>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#1C0F3F',
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatAmount(entry.amount, currency)}
                </p>
              </div>
            ))}
          </div>

          {onSeeAll && (
            <button
              type="button"
              onClick={onSeeAll}
              style={{
                background: 'none',
                border: 'none',
                padding: '12px 0 0',
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: '#8A5E10',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              See all →
            </button>
          )}
        </>
      )}
    </div>
  )
}
