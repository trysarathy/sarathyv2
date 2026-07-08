'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Profile, ChatMessage } from '@/types'
import { getAuthHeaders } from '@/lib/api-auth'
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
      const response = await fetch('/api/sarathy', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          message: text,
          isAnxious,
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
    } catch {
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        user_id: profile.id,
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
      <div className="sarathy-chat-page flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const canSend = Boolean(input.trim()) && !sending

  return (
    <div className="sarathy-chat-page">
      <header className="sarathy-chat-header sarathy-enter-1">
        <div className="sarathy-chat-header-inner">
          <div>
            <p className="sarathy-chat-kicker">Companion</p>
            <h1 className="sarathy-chat-title">Sarathy</h1>
            <p className="sarathy-chat-subtitle">your money companion</p>
          </div>
          <button
            type="button"
            onClick={handleAnxious}
            className="sarathy-chat-anxious"
          >
            😰 I&apos;m anxious
          </button>
        </div>
      </header>

      <div className="sarathy-chat-messages sarathy-enter-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`sarathy-chat-row ${msg.role === 'user' ? 'sarathy-chat-row-user' : ''}`}
          >
            {msg.role === 'assistant' && (
              <span className="sarathy-chat-flower" aria-hidden="true">🌸</span>
            )}
            <div className={msg.role === 'assistant' ? 'sarathy-bubble' : 'user-bubble'}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="sarathy-chat-row">
            <span className="sarathy-chat-flower" aria-hidden="true">🌸</span>
            <div className="sarathy-bubble flex items-center gap-1.5 py-4">
              <span className="sarathy-chat-typing-dot animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="sarathy-chat-typing-dot animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="sarathy-chat-typing-dot animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="sarathy-chat-input-zone">
        <div className="sarathy-chat-chips">
          {QUICK_CHIPS.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => sendMessage(chip)}
              className="sarathy-chat-chip"
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="sarathy-chat-input-wrap">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask Sarathy anything..."
            className="sarathy-chat-input"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!canSend}
            className={`sarathy-chat-send ${canSend ? 'sarathy-chat-send-active' : 'sarathy-chat-send-idle'}`}
            aria-label="Send message"
          >
            ↑
          </button>
        </div>
      </div>

      <TabBar active="sarathy" />
    </div>
  )
}
