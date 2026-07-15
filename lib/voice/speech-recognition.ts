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

export type VoiceRecognitionError =
  | 'not-allowed'
  | 'no-speech'
  | 'network'
  | 'unsupported'
  | 'start-failed'
  | 'unknown'

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

/** Explicit mic permission probe (also used so first tap always prompts). */
export async function requestMicrophonePermission(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (typeof navigator === 'undefined') return 'unsupported'
  if (!window.isSecureContext) return 'unsupported'
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported'

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return 'granted'
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied'
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'denied'
    return 'denied'
  }
}

export function isLikelyIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua)
  const isChromeOrCriOS = /CriOS|Chrome/.test(ua)
  const isFirefox = /FxiOS/.test(ua)
  return iOS && webkit && !isChromeOrCriOS && !isFirefox
}

/** Deep-link into Chrome on iOS/Android when possible. */
export function getOpenInChromeHref(): string {
  if (typeof window === 'undefined') return 'https://www.google.com/chrome/'
  const { host, pathname, search, hash, protocol } = window.location
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    return `googlechromes://${host}${pathname}${search}${hash}`
  }
  if (/Android/i.test(navigator.userAgent)) {
    const url = encodeURIComponent(`${protocol}//${host}${pathname}${search}${hash}`)
    return `intent://${host}${pathname}${search}${hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${url};end`
  }
  return 'https://www.google.com/chrome/'
}

function mapSpeechError(code: string): VoiceRecognitionError {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'not-allowed'
  if (code === 'no-speech') return 'no-speech'
  if (code === 'network') return 'network'
  return 'unknown'
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<VoiceRecognitionError | null>(null)
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>(
    'unknown'
  )

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const finalTranscriptRef = useRef('')
  const interimTranscriptRef = useRef('')
  const supported = isSpeechRecognitionSupported()

  const abortListening = useCallback(() => {
    recognitionRef.current?.abort()
    recognitionRef.current = null
    setIsListening(false)
    interimTranscriptRef.current = ''
    setInterimTranscript('')
  }, [])

  const stopListening = useCallback(() => {
    // Fold interim into final before stop/onend clears it — avoids empty parse on quick taps
    if (interimTranscriptRef.current) {
      finalTranscriptRef.current = `${finalTranscriptRef.current}${interimTranscriptRef.current}`
      interimTranscriptRef.current = ''
      setTranscript(finalTranscriptRef.current)
      setInterimTranscript('')
    }
    recognitionRef.current?.stop()
  }, [])

  const startListening = useCallback(async (): Promise<boolean> => {
    setError(null)

    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setError('unsupported')
      return false
    }

    const permission = await requestMicrophonePermission()
    setPermissionState(permission)
    if (permission !== 'granted') {
      setError(permission === 'unsupported' ? 'unsupported' : 'not-allowed')
      setIsListening(false)
      return false
    }

    abortListening()

    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-SG'

    finalTranscriptRef.current = ''
    interimTranscriptRef.current = ''
    setTranscript('')
    setInterimTranscript('')

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event) => {
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
      interimTranscriptRef.current = interim
      setTranscript(finalText)
      setInterimTranscript(interim)
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return
      if (event.error === 'no-speech') {
        // Keep listening UI until user stops; don't treat as hard failure mid-session
        return
      }
      setError(mapSpeechError(event.error))
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      interimTranscriptRef.current = ''
      setInterimTranscript('')
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      return true
    } catch {
      setError('start-failed')
      setIsListening(false)
      return false
    }
  }, [abortListening])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  const getFullTranscript = useCallback(() => {
    const combined = `${finalTranscriptRef.current}${interimTranscriptRef.current}`.trim()
    return combined || transcript.trim()
  }, [transcript])

  return {
    supported,
    isListening,
    transcript,
    interimTranscript,
    error,
    permissionState,
    clearError: () => setError(null),
    startListening,
    stopListening,
    abortListening,
    getFullTranscript,
  }
}
