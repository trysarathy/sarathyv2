'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, SendHorizontal, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { Profile, BudgetEntry, FixedSpending, ChatMessage } from '@/types'
import { calculateSafeToSpend, formatCurrency, getMonthEntries, groupEntriesByCategory } from '@/lib/calculations'
import {
  getCompanionLabel,
  getFirstName,
  getSarathyOpening,
  getSarathyQuickChips,
} from '@/lib/personalization'
import { getCurrentMonthDateRange } from '@/lib/dates'
import TabBar from '@/components/ui/TabBar'

const FALLBACK_CHIPS = ['Can I afford this today?', 'Show my real picture', 'Plan with me', 'Am I okay?']

function getCurrentMonthRange() {
  return getCurrentMonthDateRange()
}

export default function SarathyPage() {
  const router = useRouter()
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [isAnxious, setIsAnxious] = useState(false)
  const [todaySignal, setTodaySignal] = useState<{
    safeToSpend: number
    currency: string
    status: string
    topCategory?: string
  } | null>(null)

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { monthStart, nextMonthStart } = getCurrentMonthRange()

      const [profileRes, messagesRes, entriesRes, fixedRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('chat_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).limit(50),
        supabase.from('budget_entries').select('*').eq('user_id', user.id).gte('entry_date', monthStart).lt('entry_date', nextMonthStart),
        supabase.from('fixed_spending').select('*').eq('user_id', user.id).eq('is_active', true),
      ])

      if (profileRes.data) {
        const loadedProfile = profileRes.data as Profile
        const entries = (entriesRes.data || []) as BudgetEntry[]
        const fixed = (fixedRes.data || []) as FixedSpending[]
        const safeData = calculateSafeToSpend(loadedProfile, entries, fixed)
        const monthCategories = groupEntriesByCategory(getMonthEntries(entries))

        setProfile(loadedProfile)
        setTodaySignal({
          safeToSpend: safeData.safeToSpend,
          currency: safeData.currency,
          status: safeData.status,
          topCategory: monthCategories[0]?.category,
        })
      }

      const existingMessages = (messagesRes.data || []) as ChatMessage[]

      // If no messages, generate an opening message
      if (existingMessages.length === 0 && profileRes.data) {
        const openingMsg: ChatMessage = {
          id: 'opening',
          user_id: user.id,
          role: 'assistant',
          content: getSarathyOpening(profileRes.data as Profile),
          created_at: new Date().toISOString(),
        }
        setMessages([openingMsg])
      } else {
        setMessages(existingMessages)
      }
    } catch (err) {
      console.error('Failed to load Sarathy chat data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string, anxiousOverride = isAnxious) => {
    if (!text.trim() || sending || !profile) return
    setSending(true)

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      user_id: profile.id,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')

    try {
      // Get fresh data for context
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { monthStart, nextMonthStart } = getCurrentMonthRange()

      const [entriesRes, fixedRes] = await Promise.all([
        supabase.from('budget_entries').select('*').eq('user_id', user.id).gte('entry_date', monthStart).lt('entry_date', nextMonthStart),
        supabase.from('fixed_spending').select('*').eq('user_id', user.id).eq('is_active', true),
      ])

      const entries = (entriesRes.data || []) as BudgetEntry[]
      const fixed = (fixedRes.data || []) as FixedSpending[]
      const safeData = calculateSafeToSpend(profile, entries, fixed)
      const monthEntries = getMonthEntries(entries)
      const monthSpent = monthEntries.reduce((sum, e) => sum + e.amount, 0)

      // Call Groq via our API route
      const response = await fetch('/api/sarathy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          isAnxious: anxiousOverride,
          context: {
            name: profile.name,
            companion_vibe: profile.companion_vibe,
            currency: profile.primary_currency || 'SGD',
            planning_amount: profile.planning_amount,
            spent: monthSpent,
            safe_today: safeData.safeToSpend,
            days_remaining: safeData.daysLeft,
            status: safeData.status,
            money_fear: profile.money_fear,
            responsible_for: profile.responsible_for,
            streak: profile.daily_login_streak,
          },
          history: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await response.json()
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        user_id: profile.id,
        role: 'assistant',
        content: data.message || "I'm having a moment. Try again in a sec.",
        created_at: new Date().toISOString(),
      }

      setMessages(prev => [...prev, assistantMsg])
      setIsAnxious(false)

      // Save both messages to Supabase
      await supabase.from('chat_messages').insert([
        { user_id: user.id, role: 'user', content: text },
        { user_id: user.id, role: 'assistant', content: assistantMsg.content },
      ])

    } catch (err) {
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        user_id: profile?.id || '',
        role: 'assistant',
        content: "I'm having trouble connecting right now, but I'm here. Try again in a moment.",
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, fallbackMsg])
    } finally {
      setSending(false)
    }
  }

  const handleAnxious = () => {
    setIsAnxious(true)
    sendMessage("I'm feeling anxious about my money right now", true)
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const firstName = getFirstName(profile)
  const quickChips = profile ? getSarathyQuickChips(profile) : FALLBACK_CHIPS
  const signalPrompt = todaySignal?.topCategory
    ? `Give me a quick read on today. I have ${formatCurrency(todaySignal.safeToSpend, todaySignal.currency)} safe to spend and ${todaySignal.topCategory} is my biggest category this month.`
    : todaySignal
    ? `Give me a quick read on today. I have ${formatCurrency(todaySignal.safeToSpend, todaySignal.currency)} safe to spend.`
    : ''

  return (
    <div className="min-h-dvh bg-cream flex flex-col">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 border-b border-cream-3 bg-cream">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-fraunces text-xl font-semibold text-ink">Sarathy</h1>
            <p className="text-ink-3 text-xs">{getCompanionLabel(profile)} for {firstName}</p>
          </div>
          <button
            onClick={handleAnxious}
            className="flex items-center gap-1.5 bg-red-50 text-danger text-xs font-medium px-3 py-2 rounded-xl active:scale-95 transition-transform"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            I'm anxious
          </button>
        </div>
      </div>

      {todaySignal && (
        <div className="border-b border-cream-3 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-[480px] items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">
                Today: {formatCurrency(todaySignal.safeToSpend, todaySignal.currency)} safe
              </p>
              <p className="truncate text-xs text-ink-3">
                {todaySignal.topCategory ? `${todaySignal.topCategory} is leading this month` : 'Ask for a quick read before deciding'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => sendMessage(signalPrompt)}
              disabled={sending || !signalPrompt}
              className="rounded-full bg-saffron px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Ask
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-44 flex flex-col gap-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <span className="mr-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-saffron-soft text-saffron">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
            )}
            <div className={msg.role === 'assistant' ? 'sarathy-bubble' : 'user-bubble'}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <span className="mr-2 flex h-7 w-7 items-center justify-center rounded-full bg-saffron-soft text-saffron">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="sarathy-bubble flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-ink-3 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-ink-3 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-ink-3 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="fixed bottom-16 left-0 right-0 bg-cream border-t border-cream-3 px-4 py-3 pb-safe">
        {/* Quick chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
          {quickChips.map(chip => (
            <button
              key={chip}
              onClick={() => sendMessage(chip)}
              className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full bg-saffron-soft text-saffron border border-saffron/20 active:bg-saffron active:text-white transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Text input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask Sarathy anything..."
            className="input-field flex-1 py-3 text-sm"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            aria-label="Send message"
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white transition-all disabled:text-saffron"
            style={{
              background: input.trim() && !sending ? '#F97316' : '#FDE8D0',
            }}
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>

      <TabBar active="sarathy" />
    </div>
  )
}
