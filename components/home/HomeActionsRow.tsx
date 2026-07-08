'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import VoiceMicButton from '@/components/home/VoiceMicButton'
import { isSpeechRecognitionSupported } from '@/lib/voice/speech-recognition'

interface Props {
  onLogExpense: () => void
  onVoiceLog?: () => void
  tourRef?: React.Ref<HTMLDivElement>
}

export default function HomeActionsRow({ onLogExpense, onVoiceLog, tourRef }: Props) {
  const [voiceSupported, setVoiceSupported] = useState(false)

  useEffect(() => {
    setVoiceSupported(isSpeechRecognitionSupported())
  }, [])

  return (
    <div ref={tourRef} className="flex gap-2 items-center mb-1">
      <button
        type="button"
        onClick={onLogExpense}
        className="home-btn-log flex-1 py-3 text-sm min-w-0"
      >
        + Log expense
      </button>

      {voiceSupported && onVoiceLog && (
        <VoiceMicButton onClick={onVoiceLog} ariaLabel="Log expense by voice" />
      )}

      <Link
        href="/sarathy"
        className="home-btn-ghost flex-1 py-3 text-sm min-w-0"
      >
        Ask Sarathy
      </Link>
    </div>
  )
}
