'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import VoiceMicButton from '@/components/home/VoiceMicButton'
import { isSpeechRecognitionSupported } from '@/lib/voice/speech-recognition'

interface Props {
  onLogExpense: () => void
  onVoiceLog?: () => void
}

export default function HomeActionsRow({ onLogExpense, onVoiceLog }: Props) {
  const [voiceSupported, setVoiceSupported] = useState(false)

  useEffect(() => {
    setVoiceSupported(isSpeechRecognitionSupported())
  }, [])

  return (
    <div className="flex gap-2 items-center mb-3">
      <button
        type="button"
        onClick={onLogExpense}
        className="btn-primary !w-auto flex-1 py-3 text-sm min-w-0"
      >
        + Log expense
      </button>

      {voiceSupported && onVoiceLog && (
        <VoiceMicButton onClick={onVoiceLog} ariaLabel="Log expense by voice" />
      )}

      <Link
        href="/sarathy"
        className="btn-secondary !w-auto flex-1 py-3 text-sm flex items-center justify-center no-underline min-w-0"
      >
        Ask Sarathy
      </Link>
    </div>
  )
}
