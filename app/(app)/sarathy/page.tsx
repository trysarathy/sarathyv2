'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Profile, BudgetEntry, FixedSpending, ChatMessage } from '@/types'
import { calculateSafeToSpend, formatCurrency, getMonthEntries } from '@/lib/calculations'
import TabBar from '@/components/ui/TabBar'

const QUICK_CHIPS = ['Can I afford this?', 'My real picture', 'Plan with me', 'Am I okay?']

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

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }

    const [profileRes, messagesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('chat_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: true }).limit(50),
    ])

    if (profileRes.data) {
      setProfile(profileRes.data as Profile)
    }

    const existingMessages = (messagesRes.data || []) as ChatMessage[]

    // If no messages, generate an opening message
    if (existingMessages.length === 0 && profileRes.data) {
      const openingMsg: ChatMessage = {
        id: 'opening',
        user_id: user.id,
        role: 'assistant',
        content: `Hey ${profileRes.data.name?.split(' ')[0] || 'there'} 🌸 I'm Sarathy — I've been keeping an eye on things. What's on your mind today?`,
        created_at: new Date().toISOString(),
      }
      setMessages([openingMsg])
    } else {
      setMessages(existingMessages)
    }

    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
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

      const [entriesRes, fixedRes] = await Promise.all([
        supabase.from('budget_entries').select('*').eq('user_id', user.id),
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
          isAnxious,
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
        content: data.message || "I'm having a moment — try again in a sec 🌸",
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
        content: "I'm having trouble connecting right now — but I'm here. Try again in a moment 🌸",
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, fallbackMsg])
    } finally {
      setSending(false)
    }
  }

  const handleAnxious = () => {
    setIsAnxious(true)
    sendMessage("I'm feeling anxious about my money right now")
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-cream flex flex-col">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 border-b border-cream-3 bg-cream">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-fraunces text-xl font-semibold text-ink">Sarathy</h1>
            <p className="text-ink-3 text-xs">your money companion</p>
          </div>
          <button
            onClick={handleAnxious}
            className="bg-red-50 text-danger text-xs font-medium px-3 py-2 rounded-xl active:scale-95 transition-transform"
          >
            😰 I'm anxious
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-44 flex flex-col gap-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <span className="text-lg mr-2 mt-1 flex-shrink-0">🌸</span>
            )}
            <div className={msg.role === 'assistant' ? 'sarathy-bubble' : 'user-bubble'}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <span className="text-lg mr-2">🌸</span>
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
          {QUICK_CHIPS.map(chip => (
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
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
            style={{
              background: input.trim() && !sending ? '#F97316' : '#FDE8D0',
            }}
          >
            <span className="text-lg">↑</span>
          </button>
        </div>
      </div>

      <TabBar active="sarathy" />
    </div>
  )
}
