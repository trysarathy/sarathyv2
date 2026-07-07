'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechRecognitionInstance = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: { error: string }) => void) | null
  onresult: ((event: {
    resultIndex: number
    results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } }
  }) => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() != null
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const finalTranscriptRef = useRef('')
  const supported = isSpeechRecognitionSupported()

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const abortListening = useCallback(() => {
    recognitionRef.current?.abort()
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return

    abortListening()

    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-SG'

    finalTranscriptRef.current = ''
    setTranscript('')
    setInterimTranscript('')

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = event => {
      let interim = ''
      let finalText = finalTranscriptRef.current

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const chunk = result[0]?.transcript ?? ''
        if (result.isFinal) {
          finalText += chunk
        } else {
          interim += chunk
        }
      }

      finalTranscriptRef.current = finalText
      setTranscript(finalText)
      setInterimTranscript(interim)
    }

    recognition.onerror = event => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimTranscript('')
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [abortListening])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  const getFullTranscript = useCallback(() => {
    const combined = `${finalTranscriptRef.current}${interimTranscript}`.trim()
    return combined || transcript.trim()
  }, [interimTranscript, transcript])

  return {
    supported,
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    abortListening,
    getFullTranscript,
  }
}
