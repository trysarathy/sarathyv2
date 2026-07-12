'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  groupEntriesByCategory,
  formatCurrency,
  getCategoryEmoji,
  getMonthEntries,
} from '@/lib/calculations'
import { getProfileDisplayCurrency } from '@/lib/home/display-currency'
import { todayInSingapore } from '@/lib/sarathy/sgt'
import { Profile, BudgetEntry, PLCategory } from '@/types'
import { EXPENSE_CATEGORIES } from '@/lib/expense/categories'
import { friendlyExpenseSaveError } from '@/lib/booth/friendly-errors'
import TabBar from '@/components/ui/TabBar'
import ExploreSections from '@/components/story/ExploreSections'
import MonthSummarySheet from '@/components/home/MonthSummarySheet'

export default function StoryPage() {
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [entries, setEntries] = useState<BudgetEntry[]>([])
  const [categories, setCategories] = useState<PLCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showMonth, setShowMonth] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<PLCategory | null>(null)
  const [editingEntry, setEditingEntry] = useState<BudgetEntry | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [savingEntry, setSavingEntry] = useState(false)
  const [entrySaveError, setEntrySaveError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const [profileRes, entriesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('budget_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])

    if (profileRes.data) {
      const p = profileRes.data as Profile
      setProfile(p)
      const e = (entriesRes.error ? [] : entriesRes.data || []) as BudgetEntry[]
      setEntries(e)
      setCategories(groupEntriesByCategory(getMonthEntries(e)))
    }
    setLoading(false)
  }, [router, supabase])

  useEffect(() => { loadData() }, [loadData])

  const openEditEntry = (entry: BudgetEntry) => {
    setEditingEntry(entry)
    setEditAmount(String(entry.amount))
    setEditDescription(entry.description ?? '')
    setEditDate(entry.entry_date.slice(0, 10))
    setEditCategory(entry.category)
    setEntrySaveError(null)
  }

  const closeEditEntry = () => {
    setEditingEntry(null)
    setEntrySaveError(null)
  }

  const handleSaveEntry = async () => {
    if (!editingEntry) return
    const amount = parseFloat(editAmount)
    if (!amount || amount <= 0) {
      setEntrySaveError('Enter a valid amount')
      return
    }
    setSavingEntry(true)
    setEntrySaveError(null)
    const { error } = await supabase
      .from('budget_entries')
      .update({
        amount: Math.round(amount * 100) / 100,
        description: editDescription.trim() || null,
        entry_date: editDate,
        category: editCategory,
      })
      .eq('id', editingEntry.id)

    setSavingEntry(false)
    if (error) {
      setEntrySaveError(friendlyExpenseSaveError(error.message))
      return
    }
    closeEditEntry()
    setSelectedCategory(null)
    await loadData()
  }

  const handleDeleteEntry = async (entryId: string) => {
    setSavingEntry(true)
    setEntrySaveError(null)
    const { error } = await supabase.from('budget_entries').delete().eq('id', entryId)
    setSavingEntry(false)
    if (error) {
      setEntrySaveError(friendlyExpenseSaveError(error.message))
      return
    }
    closeEditEntry()
    setSelectedCategory(null)
    await loadData()
  }

  if (loading || !profile) {
    return (
      <div className="min-h-dvh bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const currency = getProfileDisplayCurrency(profile)
  const monthKey = todayInSingapore().slice(0, 7)
  const monthTotal = entries
    .filter((e) => e.entry_date.slice(0, 7) === monthKey)
    .reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="min-h-dvh pb-24" style={{ background: '#F5EDD8' }}>
      <div className="px-4 pt-12 pb-6">
        <ExploreSections onOpenMonth={() => setShowMonth(true)} />
      </div>

      {showMonth && (
        <MonthSummarySheet
          profile={profile}
          categories={categories}
          monthTotal={monthTotal}
          currency={currency}
          onSelectCategory={(cat) => {
            setShowMonth(false)
            setSelectedCategory(cat)
          }}
          onClose={() => setShowMonth(false)}
          onBudgetUpdated={(planningAmount) => {
            setProfile((prev) => (prev ? { ...prev, planning_amount: planningAmount } : prev))
            void loadData()
          }}
        />
      )}

      {selectedCategory && (
        <>
          <div className="overlay" onClick={() => setSelectedCategory(null)} />
          <div className="bottom-sheet">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getCategoryEmoji(selectedCategory.category)}</span>
                <div>
                  <h3 className="font-fraunces text-lg font-semibold text-ink">{selectedCategory.category}</h3>
                  <p className="text-ink-3 text-xs">{formatCurrency(selectedCategory.total, currency)} total</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedCategory(null)} className="text-ink-3 text-2xl">×</button>
            </div>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {selectedCategory.entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between py-2 border-b border-cream last:border-0 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">{entry.description || entry.category}</p>
                    <p className="text-xs text-ink-3">
                      {new Date(entry.entry_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-ink shrink-0">{formatCurrency(entry.amount, currency)}</span>
                  <button
                    type="button"
                    onClick={() => openEditEntry(entry)}
                    className="text-xs text-ink-3 px-2 py-1 rounded-lg bg-cream shrink-0"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {editingEntry && (
        <>
          <div className="overlay" onClick={closeEditEntry} />
          <div className="bottom-sheet">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-fraunces text-xl font-semibold text-ink">Edit expense</h3>
              <button type="button" onClick={closeEditEntry} className="text-ink-3 text-2xl">×</button>
            </div>
            <input
              type="number"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              placeholder="Amount"
              className="input-field mb-3"
              inputMode="decimal"
            />
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description"
              className="input-field mb-3"
            />
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="input-field mb-3"
            />
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="input-field mb-3"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {entrySaveError && (
              <p className="text-xs text-danger mb-3">{entrySaveError}</p>
            )}
            <button type="button" onClick={handleSaveEntry} disabled={savingEntry} className="btn-primary">
              {savingEntry ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteEntry(editingEntry.id)}
              disabled={savingEntry}
              className="w-full mt-3 py-3 text-sm text-danger font-medium"
            >
              Delete expense
            </button>
          </div>
        </>
      )}

      <TabBar active="story" />
    </div>
  )
}
